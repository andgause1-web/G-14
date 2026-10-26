using UnrealBuildTool;

public class G14Hud : ModuleRules
{
	public G14Hud(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core", "CoreUObject", "Engine", "InputCore",
			"UMG", "Slate", "SlateCore",
			"WebSockets", "Json", "JsonUtilities"
		});
	}
}
