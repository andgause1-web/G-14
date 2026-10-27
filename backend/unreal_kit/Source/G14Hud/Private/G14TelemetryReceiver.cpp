#include "G14TelemetryReceiver.h"

#include "WebSocketsModule.h"
#include "IWebSocket.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Engine/World.h"
#include "TimerManager.h"

DEFINE_LOG_CATEGORY_STATIC(LogG14Hud, Log, All);

namespace G14Json
{
	float Num(const TSharedPtr<FJsonObject>& Obj, const TCHAR* Key, float Default = 0.f)
	{
		double Value = Default;
		return (Obj.IsValid() && Obj->TryGetNumberField(Key, Value)) ? static_cast<float>(Value) : Default;
	}

	TSharedPtr<FJsonObject> Obj(const TSharedPtr<FJsonObject>& Parent, const TCHAR* Key)
	{
		const TSharedPtr<FJsonObject>* Out = nullptr;
		return (Parent.IsValid() && Parent->TryGetObjectField(Key, Out)) ? *Out : nullptr;
	}

	EG14EntityClass EntityClass(const FString& S)
	{
		if (S.Equals(TEXT("AHRIMANIC"), ESearchCase::IgnoreCase)) return EG14EntityClass::Ahrimanic;
		if (S.Equals(TEXT("LUCIFERIC"), ESearchCase::IgnoreCase)) return EG14EntityClass::Luciferic;
		return EG14EntityClass::Unknown;
	}

	EG14StasisState Stasis(const FString& S)
	{
		if (S.Equals(TEXT("UNSTABLE"), ESearchCase::IgnoreCase)) return EG14StasisState::Unstable;
		if (S.Equals(TEXT("DRIFTING"), ESearchCase::IgnoreCase)) return EG14StasisState::Drifting;
		return EG14StasisState::Stable;
	}

	EG14Stance Stance(const FString& S)
	{
		if (S.Equals(TEXT("crouch"), ESearchCase::IgnoreCase)) return EG14Stance::Crouch;
		if (S.Equals(TEXT("prone"), ESearchCase::IgnoreCase)) return EG14Stance::Prone;
		return EG14Stance::Stand;
	}
}

AG14TelemetryReceiver::AG14TelemetryReceiver()
{
	PrimaryActorTick.bCanEverTick = false;
}

void AG14TelemetryReceiver::BeginPlay()
{
	Super::BeginPlay();
	if (bConnectOnBeginPlay)
	{
		Connect();
	}
}

void AG14TelemetryReceiver::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	Disconnect();
	Super::EndPlay(EndPlayReason);
}

void AG14TelemetryReceiver::Connect()
{
	bWantsConnection = true;
	if (Socket.IsValid() && Socket->IsConnected())
	{
		return;
	}
	if (!FModuleManager::Get().IsModuleLoaded(TEXT("WebSockets")))
	{
		FModuleManager::Get().LoadModule(TEXT("WebSockets"));
	}

	Socket = FWebSocketsModule::Get().CreateWebSocket(ServerUrl);
	Socket->OnConnected().AddUObject(this, &AG14TelemetryReceiver::HandleConnected);
	Socket->OnConnectionError().AddUObject(this, &AG14TelemetryReceiver::HandleConnectionError);
	Socket->OnClosed().AddUObject(this, &AG14TelemetryReceiver::HandleClosed);
	Socket->OnMessage().AddUObject(this, &AG14TelemetryReceiver::HandleMessage);

	UE_LOG(LogG14Hud, Log, TEXT("G14: connecting to %s"), *ServerUrl);
	Socket->Connect();
}

void AG14TelemetryReceiver::Disconnect()
{
	bWantsConnection = false;
	if (UWorld* World = GetWorld())
	{
		World->GetTimerManager().ClearTimer(ReconnectTimer);
	}
	if (Socket.IsValid())
	{
		Socket->OnConnected().RemoveAll(this);
		Socket->OnConnectionError().RemoveAll(this);
		Socket->OnClosed().RemoveAll(this);
		Socket->OnMessage().RemoveAll(this);
		if (Socket->IsConnected())
		{
			Socket->Close();
		}
		Socket.Reset();
	}
}

bool AG14TelemetryReceiver::IsConnected() const
{
	return Socket.IsValid() && Socket->IsConnected();
}

void AG14TelemetryReceiver::HandleConnected()
{
	UE_LOG(LogG14Hud, Log, TEXT("G14: connected"));
	OnConnectionChanged.Broadcast(true);
}

void AG14TelemetryReceiver::HandleConnectionError(const FString& Error)
{
	UE_LOG(LogG14Hud, Warning, TEXT("G14: connection error: %s"), *Error);
	OnConnectionChanged.Broadcast(false);
	ScheduleReconnect();
}

void AG14TelemetryReceiver::HandleClosed(int32 StatusCode, const FString& Reason, bool bWasClean)
{
	UE_LOG(LogG14Hud, Log, TEXT("G14: closed (%d) %s"), StatusCode, *Reason);
	OnConnectionChanged.Broadcast(false);
	ScheduleReconnect();
}

void AG14TelemetryReceiver::ScheduleReconnect()
{
	UWorld* World = GetWorld();
	if (!bWantsConnection || !World)
	{
		return;
	}
	World->GetTimerManager().SetTimer(ReconnectTimer, this, &AG14TelemetryReceiver::Connect, ReconnectDelaySeconds, false);
}

void AG14TelemetryReceiver::HandleMessage(const FString& Message)
{
	ProcessMessage(Message);
}

bool AG14TelemetryReceiver::ProcessMessage(const FString& Json)
{
	FG14HudFrame Frame;
	if (!ParseFrame(Json, Frame))
	{
		return false;
	}

	const FG14IMUData PrevIMU = LatestFrame.IMU;
	const bool bFirst = !bHasFrame;
	LatestFrame = Frame;
	bHasFrame = true;

	OnFrameReceived.Broadcast(Frame);
	OnEEGChanged.Broadcast(Frame.EEG);
	OnScanChanged.Broadcast(Frame.Scan);
	OnEntitiesChanged.Broadcast(Frame.Scan.Entities);
	OnRunChanged.Broadcast(Frame.Run);
	OnLureChanged.Broadcast(Frame.Lure);

	const bool bHeadMoved = bFirst
		|| FMath::Abs(FMath::FindDeltaAngleDegrees(PrevIMU.Yaw, Frame.IMU.Yaw)) > HeadMotionThresholdDeg
		|| FMath::Abs(Frame.IMU.Pitch - PrevIMU.Pitch) > HeadMotionThresholdDeg
		|| FMath::Abs(Frame.IMU.Roll - PrevIMU.Roll) > HeadMotionThresholdDeg;
	if (bHeadMoved)
	{
		OnHeadMotionChanged.Broadcast(Frame.IMU);
	}
	return true;
}

bool AG14TelemetryReceiver::ParseFrame(const FString& Json, FG14HudFrame& Out)
{
	TSharedPtr<FJsonObject> Root;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		return false;
	}
	if (!Root->TryGetStringField(TEXT("schema"), Out.Schema) || !Out.Schema.StartsWith(TEXT("g14.hud.")))
	{
		return false;
	}

	Out.Seq = static_cast<int64>(G14Json::Num(Root, TEXT("seq")));
	double Ts = 0.0;
	Root->TryGetNumberField(TEXT("t_ms"), Ts);
	Out.TimestampMs = static_cast<int64>(Ts);
	Root->TryGetStringField(TEXT("source"), Out.Source);

	// eeg { sensor, bands{delta,theta,alpha,beta,gamma}, stasis_index, state }
	if (const TSharedPtr<FJsonObject> Eeg = G14Json::Obj(Root, TEXT("eeg")))
	{
		const TSharedPtr<FJsonObject> Bands = G14Json::Obj(Eeg, TEXT("bands"));
		Out.EEG.Delta = G14Json::Num(Bands, TEXT("delta"));
		Out.EEG.Theta = G14Json::Num(Bands, TEXT("theta"));
		Out.EEG.Alpha = G14Json::Num(Bands, TEXT("alpha"));
		Out.EEG.Beta = G14Json::Num(Bands, TEXT("beta"));
		Out.EEG.Gamma = G14Json::Num(Bands, TEXT("gamma"));
		Out.EEG.StasisIndex = G14Json::Num(Eeg, TEXT("stasis_index"), 1.f);
		FString State;
		Eeg->TryGetStringField(TEXT("state"), State);
		Out.EEG.State = G14Json::Stasis(State);
	}

	// imu { sensor, yaw_deg, pitch_deg, roll_deg }
	if (const TSharedPtr<FJsonObject> Imu = G14Json::Obj(Root, TEXT("imu")))
	{
		Out.IMU.Yaw = G14Json::Num(Imu, TEXT("yaw_deg"));
		Out.IMU.Pitch = G14Json::Num(Imu, TEXT("pitch_deg"));
		Out.IMU.Roll = G14Json::Num(Imu, TEXT("roll_deg"));
		Out.IMU.HeadHeightM = G14Json::Num(Imu, TEXT("head_height_m"), -1.f);
	}

	// scan { sensor, resonance, stability, entities[] }
	if (const TSharedPtr<FJsonObject> Scan = G14Json::Obj(Root, TEXT("scan")))
	{
		Out.Scan.Resonance = G14Json::Num(Scan, TEXT("resonance"));
		Out.Scan.Stability = G14Json::Num(Scan, TEXT("stability"), 1.f);
		const TArray<TSharedPtr<FJsonValue>>* Entities = nullptr;
		if (Scan->TryGetArrayField(TEXT("entities"), Entities))
		{
			for (const TSharedPtr<FJsonValue>& Value : *Entities)
			{
				const TSharedPtr<FJsonObject> E = Value.IsValid() ? Value->AsObject() : nullptr;
				if (!E.IsValid()) continue;
				FG14Entity Entity;
				E->TryGetStringField(TEXT("id"), Entity.Id);
				FString Class;
				E->TryGetStringField(TEXT("class"), Class);
				Entity.Class = G14Json::EntityClass(Class);
				Entity.BearingDeg = G14Json::Num(E, TEXT("bearing_deg"));
				Entity.ElevationDeg = G14Json::Num(E, TEXT("elevation_deg"));
				Entity.DistanceM = G14Json::Num(E, TEXT("distance_m"));
				Entity.Threat = G14Json::Num(E, TEXT("threat"));
				E->TryGetStringField(TEXT("type"), Entity.Type);
				E->TryGetStringField(TEXT("stage"), Entity.Stage);
				E->TryGetStringField(TEXT("disposition"), Entity.Disposition);
				Entity.LaneM = G14Json::Num(E, TEXT("lane_m"));
				E->TryGetBoolField(TEXT("countered"), Entity.bCountered);
				Out.Scan.Entities.Add(Entity);
			}
		}
	}

	// hud { cognitive_load, throttle_tier, target_lock, stable_zone }
	if (const TSharedPtr<FJsonObject> Hud = G14Json::Obj(Root, TEXT("hud")))
	{
		Out.Hud.CognitiveLoad = G14Json::Num(Hud, TEXT("cognitive_load"));
		Out.Hud.ThrottleTier = static_cast<int32>(G14Json::Num(Hud, TEXT("throttle_tier")));
		Hud->TryGetBoolField(TEXT("target_lock"), Out.Hud.bTargetLock);
		Hud->TryGetBoolField(TEXT("stable_zone"), Out.Hud.bStableZone);
		Out.Hud.bObserverFilter = true;
		Hud->TryGetBoolField(TEXT("observer_filter"), Out.Hud.bObserverFilter);
		Out.Hud.BossObservation = G14Json::Num(Hud, TEXT("boss_observation"));
		Hud->TryGetStringField(TEXT("mode"), Out.Hud.Mode);
		Hud->TryGetBoolField(TEXT("calm_assist"), Out.Hud.bCalmAssist);
		Hud->TryGetStringArrayField(TEXT("focus_ids"), Out.Hud.FocusIds);
	}

	Root->TryGetStringField(TEXT("zone"), Out.Zone);
	if (const TSharedPtr<FJsonObject> Bio = G14Json::Obj(Root, TEXT("bio")))
	{
		Out.Bio.HeartRateBpm = static_cast<int32>(G14Json::Num(Bio, TEXT("heart_rate_bpm")));
		Out.Bio.SpO2 = static_cast<int32>(G14Json::Num(Bio, TEXT("spo2")));
		Out.Bio.BreathHz = G14Json::Num(Bio, TEXT("breath_hz"), 0.23f);
		Out.Bio.BreathPhase = G14Json::Num(Bio, TEXT("breath_phase"));
	}

	// run { mode, speed_mps, eye_m, stance, brake_m, travelled_m, overrun, step }
	if (const TSharedPtr<FJsonObject> Run = G14Json::Obj(Root, TEXT("run")))
	{
		Run->TryGetStringField(TEXT("mode"), Out.Run.Mode);
		Out.Run.bActive = !Out.Run.Mode.Equals(TEXT("off"), ESearchCase::IgnoreCase);
		Out.Run.SpeedMps = G14Json::Num(Run, TEXT("speed_mps"));
		Out.Run.EyeM = G14Json::Num(Run, TEXT("eye_m"), 1.6f);
		FString Stance;
		Run->TryGetStringField(TEXT("stance"), Stance);
		Out.Run.Stance = G14Json::Stance(Stance);
		Out.Run.BrakeM = G14Json::Num(Run, TEXT("brake_m"));
		Out.Run.TravelledM = G14Json::Num(Run, TEXT("travelled_m"));
		Run->TryGetBoolField(TEXT("overrun"), Out.Run.bOverrun);
		Out.Run.StepCount = static_cast<int32>(G14Json::Num(Run, TEXT("step")));
	}

	// hud.lure { target_id, pull, resist, resisting, dx_deg, dy_deg }
	if (const TSharedPtr<FJsonObject> Hud = G14Json::Obj(Root, TEXT("hud")))
	{
		if (const TSharedPtr<FJsonObject> Lure = G14Json::Obj(Hud, TEXT("lure")))
		{
			Lure->TryGetStringField(TEXT("target_id"), Out.Lure.TargetId);
			Out.Lure.Pull = G14Json::Num(Lure, TEXT("pull"));
			Out.Lure.Resist = G14Json::Num(Lure, TEXT("resist"));
			Lure->TryGetBoolField(TEXT("resisting"), Out.Lure.bResisting);
			Out.Lure.OffsetYawDeg = G14Json::Num(Lure, TEXT("dx_deg"));
			Out.Lure.OffsetPitchDeg = G14Json::Num(Lure, TEXT("dy_deg"));
		}
	}
	return true;
}
