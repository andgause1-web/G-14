// G-14 Aether Wave — shared HUD message types (schema g14.hud.v1)
#pragma once

#include "CoreMinimal.h"
#include "G14HudTypes.generated.h"

UENUM(BlueprintType)
enum class EG14EntityClass : uint8
{
	Unknown    UMETA(DisplayName = "Unknown"),
	Ahrimanic  UMETA(DisplayName = "Ahrimanic"),   // hostile, sharp red wireframe
	Luciferic  UMETA(DisplayName = "Luciferic")    // dampened, translucent cyan
};

UENUM(BlueprintType)
enum class EG14StasisState : uint8
{
	Stable,
	Drifting,
	Unstable
};

// Observer-throttling priority: low priority elements fade first under cognitive load
UENUM(BlueprintType)
enum class EG14HudElement : uint8
{
	Compass,   // priority 1
	Radar,     // priority 1
	Stasis,    // priority 2
	Entities,  // priority 3 (never throttled)
	Reticle    // priority 3 (never throttled)
};

// ADS1299 — relative band power, each 0..1, sums to ~1
USTRUCT(BlueprintType)
struct FG14EEGData
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "G14|EEG") float Delta = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "G14|EEG") float Theta = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "G14|EEG") float Alpha = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "G14|EEG") float Beta = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "G14|EEG") float Gamma = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "G14|EEG") float StasisIndex = 1.f; // 0..1
	UPROPERTY(BlueprintReadOnly, Category = "G14|EEG") EG14StasisState State = EG14StasisState::Stable;
};

// BMI270 — head orientation in degrees
USTRUCT(BlueprintType)
struct FG14IMUData
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "G14|IMU") float Yaw = 0.f;   // -180..180
	UPROPERTY(BlueprintReadOnly, Category = "G14|IMU") float Pitch = 0.f; // -90..90
	UPROPERTY(BlueprintReadOnly, Category = "G14|IMU") float Roll = 0.f;  // -180..180
};

USTRUCT(BlueprintType)
struct FG14Entity
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "G14|Scan") FString Id;
	UPROPERTY(BlueprintReadOnly, Category = "G14|Scan") EG14EntityClass Class = EG14EntityClass::Unknown;
	UPROPERTY(BlueprintReadOnly, Category = "G14|Scan") float BearingDeg = 0.f;   // world bearing, same frame as IMU yaw
	UPROPERTY(BlueprintReadOnly, Category = "G14|Scan") float ElevationDeg = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "G14|Scan") float DistanceM = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "G14|Scan") float Threat = 0.f;       // 0..1
};

// TSL1401CL multispectral scan + derived resonance values
USTRUCT(BlueprintType)
struct FG14ScanData
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "G14|Scan") float Resonance = 0.f; // 0..1
	UPROPERTY(BlueprintReadOnly, Category = "G14|Scan") float Stability = 1.f; // 0..1
	UPROPERTY(BlueprintReadOnly, Category = "G14|Scan") TArray<FG14Entity> Entities;
};

USTRUCT(BlueprintType)
struct FG14HudState
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "G14|HUD") float CognitiveLoad = 0.f; // 0..1
	UPROPERTY(BlueprintReadOnly, Category = "G14|HUD") int32 ThrottleTier = 0;    // 0,1,2
	UPROPERTY(BlueprintReadOnly, Category = "G14|HUD") bool bTargetLock = false;
	UPROPERTY(BlueprintReadOnly, Category = "G14|HUD") bool bStableZone = false;
};

USTRUCT(BlueprintType)
struct FG14HudFrame
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "G14") FString Schema;
	UPROPERTY(BlueprintReadOnly, Category = "G14") int64 Seq = 0;
	UPROPERTY(BlueprintReadOnly, Category = "G14") int64 TimestampMs = 0;
	UPROPERTY(BlueprintReadOnly, Category = "G14") FString Source;
	UPROPERTY(BlueprintReadOnly, Category = "G14") FG14EEGData EEG;
	UPROPERTY(BlueprintReadOnly, Category = "G14") FG14IMUData IMU;
	UPROPERTY(BlueprintReadOnly, Category = "G14") FG14ScanData Scan;
	UPROPERTY(BlueprintReadOnly, Category = "G14") FG14HudState Hud;
};
