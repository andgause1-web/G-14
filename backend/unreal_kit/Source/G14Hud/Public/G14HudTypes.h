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
	// Optional: eye height above floor in metres (BMI270 + baro / stance). <0 = not sent
	UPROPERTY(BlueprintReadOnly, Category = "G14|IMU") float HeadHeightM = -1.f;
};

UENUM(BlueprintType)
enum class EG14Stance : uint8
{
	Stand,
	Crouch,
	Prone
};

// Live Vector Run (hallway) — movement state; drive camera height, path splines, footstep audio
USTRUCT(BlueprintType)
struct FG14RunData
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "G14|Run") FString Mode = TEXT("off"); // off | manual | auto
	UPROPERTY(BlueprintReadOnly, Category = "G14|Run") float SpeedMps = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "G14|Run") float EyeM = 1.6f;          // eye height, metres
	UPROPERTY(BlueprintReadOnly, Category = "G14|Run") EG14Stance Stance = EG14Stance::Stand;
	UPROPERTY(BlueprintReadOnly, Category = "G14|Run") float BrakeM = 0.f;         // reaction + v^2 / 2a
	UPROPERTY(BlueprintReadOnly, Category = "G14|Run") float TravelledM = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "G14|Run") bool bOverrun = false;      // hostile inside brake distance
	UPROPERTY(BlueprintReadOnly, Category = "G14|Run") int32 StepCount = 0;        // increments once per footfall
	UPROPERTY(BlueprintReadOnly, Category = "G14|Run") bool bActive = false;
};

// Luciferic lure — crosshair pull toward a false-light entity, resisted by composure
USTRUCT(BlueprintType)
struct FG14LureData
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "G14|Lure") FString TargetId;          // empty = none
	UPROPERTY(BlueprintReadOnly, Category = "G14|Lure") float Pull = 0.f;          // 0..1 after resistance
	UPROPERTY(BlueprintReadOnly, Category = "G14|Lure") float Resist = 0.f;        // 0..1 (composure + space + alpha/beta)
	UPROPERTY(BlueprintReadOnly, Category = "G14|Lure") bool bResisting = false;   // operator is actively steadying
	UPROPERTY(BlueprintReadOnly, Category = "G14|Lure") float OffsetYawDeg = 0.f;  // add to reticle position
	UPROPERTY(BlueprintReadOnly, Category = "G14|Lure") float OffsetPitchDeg = 0.f;
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
	// Optional (corridor scene): pygmy | wraith | golem | gnome | boss
	UPROPERTY(BlueprintReadOnly, Category = "G14|Scan") FString Type;
	// Optional: DETECTED | CLASSIFYING | IDENTIFIED | TRACKING | PROXIMITY | OBSERVED
	UPROPERTY(BlueprintReadOnly, Category = "G14|Scan") FString Stage;
	// Optional: HOSTILE | NEUTRAL | SUBMITTED | DORMANT
	UPROPERTY(BlueprintReadOnly, Category = "G14|Scan") FString Disposition;
	UPROPERTY(BlueprintReadOnly, Category = "G14|Scan") float LaneM = 0.f;        // lateral offset in metres
	UPROPERTY(BlueprintReadOnly, Category = "G14|Scan") bool bCountered = false;
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
	UPROPERTY(BlueprintReadOnly, Category = "G14|HUD") bool bObserverFilter = true;
	UPROPERTY(BlueprintReadOnly, Category = "G14|HUD") float BossObservation = 0.f; // 0..1
	UPROPERTY(BlueprintReadOnly, Category = "G14|HUD") FString Mode;                // "ghost" | "full"
	UPROPERTY(BlueprintReadOnly, Category = "G14|HUD") bool bCalmAssist = false;
	UPROPERTY(BlueprintReadOnly, Category = "G14|HUD") TArray<FString> FocusIds;    // Dead Core: max 3 tracked
};

// MAX30102 — heart rate / SpO2
USTRUCT(BlueprintType)
struct FG14BioData
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "G14|Bio") int32 HeartRateBpm = 0;
	UPROPERTY(BlueprintReadOnly, Category = "G14|Bio") int32 SpO2 = 0;
	UPROPERTY(BlueprintReadOnly, Category = "G14|Bio") float BreathHz = 0.23f;     // breaths per second
	UPROPERTY(BlueprintReadOnly, Category = "G14|Bio") float BreathPhase = 0.f;    // radians; sin>0 = inhale
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
	UPROPERTY(BlueprintReadOnly, Category = "G14") FG14BioData Bio;
	UPROPERTY(BlueprintReadOnly, Category = "G14") FString Zone;
	UPROPERTY(BlueprintReadOnly, Category = "G14") FG14RunData Run;
	UPROPERTY(BlueprintReadOnly, Category = "G14") FG14LureData Lure;
};
