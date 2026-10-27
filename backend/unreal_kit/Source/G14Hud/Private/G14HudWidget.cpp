#include "G14HudWidget.h"
#include "G14TelemetryReceiver.h"
#include "Kismet/GameplayStatics.h"

void UG14HudWidget::NativeConstruct()
{
	Super::NativeConstruct();
	if (bAutoFindReceiver && !Receiver)
	{
		if (AActor* Found = UGameplayStatics::GetActorOfClass(this, AG14TelemetryReceiver::StaticClass()))
		{
			BindToReceiver(Cast<AG14TelemetryReceiver>(Found));
		}
	}
}

void UG14HudWidget::NativeDestruct()
{
	BindToReceiver(nullptr);
	Super::NativeDestruct();
}

void UG14HudWidget::BindToReceiver(AG14TelemetryReceiver* InReceiver)
{
	if (Receiver)
	{
		Receiver->OnFrameReceived.RemoveDynamic(this, &UG14HudWidget::HandleFrame);
		Receiver->OnConnectionChanged.RemoveDynamic(this, &UG14HudWidget::HandleConnection);
	}
	Receiver = InReceiver;
	if (Receiver)
	{
		Receiver->OnFrameReceived.AddDynamic(this, &UG14HudWidget::HandleFrame);
		Receiver->OnConnectionChanged.AddDynamic(this, &UG14HudWidget::HandleConnection);
		if (Receiver->HasFrame())
		{
			HandleFrame(Receiver->GetLatestFrame());
		}
	}
}

void UG14HudWidget::HandleConnection(bool bConnected)
{
	OnLinkChanged(bConnected);
}

void UG14HudWidget::HandleFrame(const FG14HudFrame& Frame)
{
	LastFrame = Frame;
	UpdateStasisMeter(Frame.EEG);
	UpdateRun(Frame.Run);
	UpdateLure(Frame.Lure);
	UpdateCompass(Frame.IMU);
	UpdateEntities(Frame.Scan.Entities);
	UpdateTargeting(Frame.Scan, Frame.Hud.bTargetLock, Frame.Hud.bStableZone);

	const int32 Tier = bObserverThrottling ? Frame.Hud.ThrottleTier : 0;
	if (Tier != LastTier)
	{
		LastTier = Tier;
		ApplyObserverThrottle(Tier, Frame.Hud.CognitiveLoad);
	}
}

bool UG14HudWidget::ProjectEntity(const FG14Entity& Entity, FVector2D& OutNormalized, float& OutScale) const
{
	const float DeltaYaw = FMath::FindDeltaAngleDegrees(LastFrame.IMU.Yaw, Entity.BearingDeg);
	const float DeltaPitch = Entity.ElevationDeg - LastFrame.IMU.Pitch;
	const FVector2D Centered(DeltaYaw / HorizontalFovDeg, -DeltaPitch / VerticalFovDeg);

	// Counter-rotate by head roll so silhouettes stay locked to the world
	const float R = FMath::DegreesToRadians(-LastFrame.IMU.Roll);
	const float C = FMath::Cos(R);
	const float S = FMath::Sin(R);
	OutNormalized = FVector2D(Centered.X * C - Centered.Y * S, Centered.X * S + Centered.Y * C) + FVector2D(0.5f, 0.5f);

	// 1.0 = a figure ~160px tall at 1080p, same curve as the simulator
	OutScale = FMath::Clamp((6000.f / (Entity.DistanceM + 6.f)) / 160.f, 0.3f, 2.4f);
	return FMath::Abs(DeltaYaw) <= HorizontalFovDeg * 0.5f + 10.f;
}

void UG14HudWidget::GetLissajousPoints(float Resonance, float Phase, int32 NumPoints, TArray<FVector2D>& OutPoints)
{
	NumPoints = FMath::Max(NumPoints, 2);
	OutPoints.Reset(NumPoints);
	const float A = 1.f + FMath::FloorToFloat(FMath::Clamp(Resonance, 0.f, 1.f) * 4.f);
	const float B = A + 1.f;
	for (int32 i = 0; i < NumPoints; ++i)
	{
		const float T = (static_cast<float>(i) / (NumPoints - 1)) * 2.f * PI;
		OutPoints.Add(FVector2D(FMath::Sin(A * T + Phase), FMath::Sin(B * T)));
	}
}

float UG14HudWidget::ChladniValue(float X, float Y, float N, float M)
{
	return FMath::Cos(N * PI * X) * FMath::Cos(M * PI * Y) - FMath::Cos(M * PI * X) * FMath::Cos(N * PI * Y);
}

float UG14HudWidget::GetElementOpacity(EG14HudElement Element) const
{
	const int32 Tier = FMath::Max(LastTier, 0);
	const bool bLow = Element == EG14HudElement::Compass || Element == EG14HudElement::Radar;
	const bool bMid = Element == EG14HudElement::Stasis;
	if (Tier >= 2 && bLow) return 0.12f;
	if (Tier >= 2 && bMid) return 0.35f;
	if (Tier >= 1 && bLow) return 0.3f;
	return 1.f;
}
