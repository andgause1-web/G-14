// G-14 Aether Wave — UMG HUD widget base. Create a Widget Blueprint with this as parent class.
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "G14HudTypes.h"
#include "G14HudWidget.generated.h"

class AG14TelemetryReceiver;

UCLASS(Abstract, Blueprintable)
class G14HUD_API UG14HudWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "G14|HUD")
	void BindToReceiver(AG14TelemetryReceiver* InReceiver);

	// Visor field of view used to project entity bearings to screen space (matches the web simulator)
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "G14|HUD") float HorizontalFovDeg = 90.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "G14|HUD") float VerticalFovDeg = 56.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "G14|HUD") bool bAutoFindReceiver = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "G14|HUD") bool bObserverThrottling = true;

	// Entity screen position in 0..1 visor space (world-locked, counter-rotated by head roll). Returns false if outside the visor.
	UFUNCTION(BlueprintPure, Category = "G14|HUD")
	bool ProjectEntity(const FG14Entity& Entity, FVector2D& OutNormalized, float& OutScale) const;

	// Lissajous reticle points in -1..1. Higher resonance = more complex figure.
	UFUNCTION(BlueprintPure, Category = "G14|HUD")
	static void GetLissajousPoints(float Resonance, float Phase, int32 NumPoints, TArray<FVector2D>& OutPoints);

	// Chladni plate value at X,Y in -1..1. Pattern lines are where the value is near 0 (use in a material or a render target).
	UFUNCTION(BlueprintPure, Category = "G14|HUD")
	static float ChladniValue(float X, float Y, float N, float M);

	// Opacity an element should use under the current observer-throttle tier
	UFUNCTION(BlueprintPure, Category = "G14|HUD")
	float GetElementOpacity(EG14HudElement Element) const;

	UFUNCTION(BlueprintPure, Category = "G14|HUD")
	FG14HudFrame GetLastFrame() const { return LastFrame; }

protected:
	virtual void NativeConstruct() override;
	virtual void NativeDestruct() override;

	// ---- Implement these in your Widget Blueprint ----
	UFUNCTION(BlueprintImplementableEvent, Category = "G14|HUD") void UpdateStasisMeter(const FG14EEGData& EEG);
	UFUNCTION(BlueprintImplementableEvent, Category = "G14|HUD") void UpdateCompass(const FG14IMUData& IMU);
	UFUNCTION(BlueprintImplementableEvent, Category = "G14|HUD") void UpdateEntities(const TArray<FG14Entity>& Entities);
	UFUNCTION(BlueprintImplementableEvent, Category = "G14|HUD") void UpdateTargeting(const FG14ScanData& Scan, bool bTargetLock, bool bStableZone);
	UFUNCTION(BlueprintImplementableEvent, Category = "G14|HUD") void ApplyObserverThrottle(int32 Tier, float CognitiveLoad);
	UFUNCTION(BlueprintImplementableEvent, Category = "G14|HUD") void OnLinkChanged(bool bConnected);

	UPROPERTY(BlueprintReadOnly, Category = "G14|HUD")
	TObjectPtr<AG14TelemetryReceiver> Receiver;

private:
	UFUNCTION() void HandleFrame(const FG14HudFrame& Frame);
	UFUNCTION() void HandleConnection(bool bConnected);

	FG14HudFrame LastFrame;
	int32 LastTier = -1;
};
