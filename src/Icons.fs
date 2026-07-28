module Icons

/// Closed preset list of kid-friendly emoji, used for both Stamps and Rewards.
/// Grouped loosely by category for a nicer picker layout, but exposed as one flat list.
/// ~60 icons total, no free-text entry — deliberately closed set per product decision.

type IconGroup = {
    Label: string
    Icons: string list
}

let groups : IconGroup list = [
    { Label = "Stars & sky"
      Icons = [ "⭐"; "🌟"; "✨"; "🌈"; "☀️"; "🌙"; "☁️"; "⚡"; "🌠"; "🪐" ] }
    { Label = "Nature"
      Icons = [ "🌸"; "🌷"; "🌻"; "🍀"; "🌵"; "🌳"; "🍄"; "🦋"; "🐝"; "🐞" ] }
    { Label = "Animals"
      Icons = [ "🐶"; "🐱"; "🐰"; "🦊"; "🐼"; "🐨"; "🦁"; "🐯"; "🐸"; "🐢" ] }
    { Label = "Food & treats"
      Icons = [ "🍦"; "🍩"; "🍭"; "🍪"; "🍓"; "🍉"; "🧁"; "🍕"; "🍎"; "🍯" ] }
    { Label = "Fun & prizes"
      Icons = [ "🏆"; "🥇"; "🎖️"; "👑"; "💎"; "🎁"; "🎈"; "🎉"; "🎨"; "🎵" ] }
    { Label = "Adventure"
      Icons = [ "🚀"; "⚓"; "🏰"; "🗺️"; "🧩"; "🪁"; "⚽"; "🚲"; "🛹"; "🏕️" ] }
]

let all : string list =
    groups |> List.collect (fun g -> g.Icons)
