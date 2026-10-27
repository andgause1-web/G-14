// G-14 Aether Wave — WebSocket telemetry receiver actor
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "G14HudTypes.h"
#include "G14TelemetryReceiver.generated.h"

class IWebSocket;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnG14FrameReceived, const FG14HudFrame&, Frame);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnG14EEGChanged, const FG14EEGData&, EEG);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnG14HeadMotionChanged, const FG14IMUData&, IMU);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnG14EntitiesChanged, const TArray<FG14Entity>&, Entities);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnG14ScanChanged, const FG14ScanData&, Scan);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnG14ConnectionChanged, bool, bConnected);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnG14RunChanged, const FG14RunData&, Run);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnG14LureChanged, const FG14LureData&, Lure);

UCLASS(Blueprintable, ClassGroup = (G14))
class G14HUD_API AG14TelemetryReceiver : public AActor
{
	GENERATED_BODY()

public:
	AG14TelemetryReceiver();

	// Subscriber endpoint, e.g. wss://<sim-host>/api/ws/hud  (or ws://<esp32-ip>:81/ later)
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "G14|Connection")
	FString ServerUrl = TEXT("wss://YOUR-SIM-HOST/api/ws/hud");

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "G14|Connection")
	bool bConnectOnBeginPlay = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "G14|Connection", meta = (ClampMin = "0.5"))
	float ReconnectDelaySeconds = 2.f;

	// Head motion event only fires when yaw/pitch/roll moves more than this
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "G14|Events", meta = (ClampMin = "0.0"))
	float HeadMotionThresholdDeg = 0.25f;

	UPROPERTY(BlueprintAssignable, Category = "G14|Events") FOnG14FrameReceived OnFrameReceived;
	UPROPERTY(BlueprintAssignable, Category = "G14|Events") FOnG14EEGChanged OnEEGChanged;
	UPROPERTY(BlueprintAssignable, Category = "G14|Events") FOnG14HeadMotionChanged OnHeadMotionChanged;
	UPROPERTY(BlueprintAssignable, Category = "G14|Events") FOnG14EntitiesChanged OnEntitiesChanged;
	UPROPERTY(BlueprintAssignable, Category = "G14|Events") FOnG14ScanChanged OnScanChanged;
	UPROPERTY(BlueprintAssignable, Category = "G14|Events") FOnG14ConnectionChanged OnConnectionChanged;
	UPROPERTY(BlueprintAssignable, Category = "G14|Events") FOnG14RunChanged OnRunChanged;
	UPROPERTY(BlueprintAssignable, Category = "G14|Events") FOnG14LureChanged OnLureChanged;

	UFUNCTION(BlueprintCallable, Category = "G14|Connection") void Connect();
	UFUNCTION(BlueprintCallable, Category = "G14|Connection") void Disconnect();
	UFUNCTION(BlueprintPure, Category = "G14|Connection") bool IsConnected() const;

	UFUNCTION(BlueprintPure, Category = "G14") FG14HudFrame GetLatestFrame() const { return LatestFrame; }
	UFUNCTION(BlueprintPure, Category = "G14") bool HasFrame() const { return bHasFrame; }

	// Feed a JSON frame from any source (serial, UDP, file replay). Returns false if it failed to parse.
	UFUNCTION(BlueprintCallable, Category = "G14") bool ProcessMessage(const FString& Json);

	static bool ParseFrame(const FString& Json, FG14HudFrame& OutFrame);

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	void HandleConnected();
	void HandleConnectionError(const FString& Error);
	void HandleClosed(int32 StatusCode, const FString& Reason, bool bWasClean);
	void HandleMessage(const FString& Message);
	void ScheduleReconnect();

	TSharedPtr<IWebSocket> Socket;
	FTimerHandle ReconnectTimer;
	FG14HudFrame LatestFrame;
	bool bHasFrame = false;
	bool bWantsConnection = false;
};
