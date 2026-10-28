// Word pools for the v3 deterministic fish-name generator.
// Plain data only -- no logic. See names.js (consumer) for how pools combine.

export const ADJECTIVES = [
  "sleepy", "turbo", "crispy", "legendary", "glorious", "soggy", "cosmic", "sneaky", "cranky", "wobbly", "fuzzy", "spicy", "gentle", "grumpy", "bouncy", "shiny", "rusty", "salty", "zesty", "mellow", "quirky", "dizzy", "jolly", "feisty", "nifty", "plucky", "wacky", "snazzy", "groovy", "funky", "chunky", "lanky", "gloomy", "sparkly", "electric", "radiant", "mighty", "humble", "dapper", "rowdy", "breezy", "chilly", "toasty", "frosty", "blazing", "glowing", "shimmering", "iridescent", "luminous", "phantom", "ghostly", "spectral", "rogue", "feral", "wild", "tame", "docile", "ornery", "jumpy", "twitchy", "wiggly", "squishy", "slippery", "slimy", "gooey", "crunchy", "flaky", "buttery", "syrupy", "fizzy", "bubbly", "frothy", "foamy", "murky", "muddy", "dusty", "sandy", "pebbly", "craggy", "mossy", "leafy", "thorny", "prickly", "velvety", "silky", "fluffy", "feathery", "scaly", "speckled", "striped", "spotted", "patchy", "mottled", "freckled", "dappled", "painted", "gilded", "bronzed", "silvered", "golden", "platinum", "emerald", "sapphire", "ruby", "amber", "jade", "pearly", "crystal", "frozen", "molten", "sizzling", "roaring", "whispering", "snoozing", "drowsy", "perky", "peppy", "zippy", "snappy", "chatty", "silent", "stealthy", "cunning", "clever", "brainy", "nerdy", "dorky", "goofy", "silly", "absurd", "ridiculous", "epic", "heroic", "valiant", "daring", "fearless", "timid", "shy", "bashful", "proud", "vain", "smug", "cheeky", "sassy", "spunky", "bold", "brave", "curious", "nosy", "snoopy", "tipsy", "woozy", "loopy", "groggy", "jumbled", "tangled", "knotted", "twisted", "crooked", "bent", "lumpy", "bumpy", "knobby", "gangly", "stubby", "portly", "plump", "stout", "svelte", "sleek", "glossy", "matte", "transparent", "translucent", "opaque", "vivid", "pastel", "neon", "glowworm", "psychedelic", "retro", "vintage", "futuristic", "ancient", "primordial", "mythical", "fabled", "storied", "whimsical", "mystic", "arcane", "enchanted", "bewitched", "cursed", "blessed", "holy", "unholy", "infernal", "celestial", "lunar", "solar", "stellar", "galactic", "interstellar", "nebulous", "meteoric", "tidal", "oceanic", "abyssal", "tropical", "arctic", "polar", "equatorial", "volcanic", "glacial", "tectonic", "seismic", "atomic", "nuclear", "quantum", "digital", "analog", "mechanical", "robotic", "clockwork", "steampunk", "industrial", "rustic", "pastoral", "urban", "suburban", "nomadic", "wandering", "roaming", "drifting", "floating", "soaring", "diving", "burrowing",
];

export const NOUNS = [
  "guppy", "mackerel", "minnow", "carp", "tetra", "grouper", "herring", "sardine", "anchovy", "mullet", "snapper", "halibut", "flounder", "catfish", "koi", "goldfish", "betta", "molly", "danio", "barb", "loach", "gourami", "cichlid", "pike", "perch", "bass", "trout", "salmon", "eel", "lamprey", "gar", "sturgeon", "ray", "skate", "dogfish", "wrasse", "parrotfish", "clownfish", "damselfish", "angelfish", "triggerfish", "pufferfish", "boxfish", "lionfish", "gobyfish", "blenny", "dartfish", "hogfish", "jawfish", "sandperch", "gloomfin", "wobblegill", "snootfish", "bumblefin", "drizzlejaw", "mudwhistle", "puddlefin", "ripplesnout", "glimmerscale", "murkgill", "shadowtail", "driftbelly", "pebblemouth", "sogglefin", "wrinklegill", "noodlefin", "squiggletail", "blorpfish", "flumpgill", "wigglesnout", "bassoon", "waffle", "spork", "pancake", "kazoo", "trombone", "accordion", "tuba", "ukulele", "banjo", "muffin", "biscuit", "pretzel", "dumpling", "noodle", "meatball", "burrito", "taco", "bagel", "crumpet", "umbrella", "galosh", "mitten", "teapot", "kettle", "toaster", "blender", "spatula", "ladle", "whisk", "doorknob", "hinge", "bolt", "washer", "gasket", "piston", "gizmo", "widget", "gadget", "contraption", "balloon", "kite", "yoyo", "pinwheel", "unicycle", "wagon", "sled", "toboggan", "trampoline", "seesaw", "lantern", "candle", "lightbulb", "flashlight", "compass", "telescope", "periscope", "binoculars", "sextant", "anchor", "barnacle", "clam", "mussel", "oyster", "urchin", "starfish", "jellyfish", "octopus", "squid", "cuttlefish", "shrimp", "crayfish", "lobster", "crab", "prawn", "snail", "slug", "newt", "tadpole", "polliwog",
];

export const QUALIFIERS = [
  "Lesser", "Greater", "Banded", "Spotted", "Royal", "Pygmy", "Northern", "Southern", "Eastern", "Western", "Dusky", "False", "Painted", "Common", "Giant", "Dwarf", "Striped", "Mottled", "Golden", "Silver", "Crimson", "Azure", "Emerald", "Amber", "Freckled", "Speckled", "Hooded", "Crested", "Barred", "Masked", "Blue-ringed", "Red-finned", "Black-tailed", "Grey", "White-spotted", "Imperial", "Noble", "Wandering", "Spiny", "Armored", "Fringed", "Veiled", "Horned", "Bearded", "Winged", "Shadow",
];

export const STEMS = [
  "Gloom", "Thorn", "Moon", "Ember", "Pebble", "Silver", "Mud", "Lantern", "Shadow", "Frost", "Storm", "Coral", "Kelp", "Reed", "Mire", "Brine", "Tide", "Current", "Whirl", "Ripple", "Glimmer", "Glow", "Dusk", "Dawn", "Rust", "Iron", "Stone", "Ash", "Smoke", "Fog", "Mist", "Cinder", "Flicker", "Spark", "Drift", "Wisp", "Shade", "Hollow", "Marsh", "Bog", "Reef", "Grotto", "Cave", "Cliff", "Bramble", "Nettle", "Fern", "Willow", "Birch", "Cedar",
];

export const SUFFIXES = [
  "fin", "gill", "mouth", "tail", "jaw", "scale", "belly", "snout", "fish", "eye", "back", "nose", "whisker", "fang", "tooth", "spine", "crest", "horn", "beard", "wing", "claw", "gut", "throat", "cheek", "brow", "lip", "chin", "ear", "flank", "skin",
];

export const FULL = [
  "Sir Reginald Bubbleworth", "Captain Soggybottom", "Gill Murray", "The Duke of Kelp", "Finn Diesel", "Admiral Snorkelton", "Lady Fintastic", "Baron von Fishstick", "Professor Gurglesworth", "Count Flounderstein", "Mayor Mackerelson", "Doctor Finnegan Scales", "Sergeant Splashwell", "Reverend Rodney Ripple", "Earl of Eelington", "Duchess Bubbletina", "Chief Herring Bone", "Madame Fillet", "General Gobygan", "Lieutenant Loachley", "Fin Diesel Jr.", "Carpe Diem", "Sushi Rollins", "Guppy Love", "Catfish Stevens", "Bass Reeves III", "Finnick Odair-fish", "Jaws Patrol", "Nemo's Uncle Gary", "Wanda the Wobbly", "Big Gill Thornton", "Little Minnow Pete", "Old Man River Pike", "Granny Gurgles", "Uncle Barnacle", "Aunt Puddlewick", "Cousin Carpington", "Buddy Blowfish", "Scooter McScales", "Tank the Terrible", "Pickles von Pufferton", "Waffles the Wise", "Noodle Napoleon", "Spork McGillicuddy", "Bassoon Baxter", "Duke Driftwood", "Baroness Barnaclebum", "Sir Swims-a-Lot", "Lady Lurksalot", "The Right Honorable Finbert", "Gilligan Finsley", "Marlin Monroe", "Betta Midler", "Carp Diem Jr.", "Haddock Holmes", "Sherlock Finns", "Moby's Little Cousin", "Flipper Flanagan", "Nessie's Nephew", "Kraken Jr.", "Squidward's Rival", "Eel Musk", "Tuna Turner", "Salmon Rushdie", "Perch Perry", "Guy Finchie", "Bream Pitt", "Cod Almighty", "Sole Survivor", "Plaice Holder", "Mr. Fishypants", "Mrs. Scaleswood", "Doctor Dorsal", "Nurse Nibbles", "Chef Chowderhead", "Pirate Pete the Pufferfish", "Wizard Wigglesworth", "Knight Sir Nibbles", "Jester Jellyfin", "King Krill the First", "Queen Coralina", "Princess Pebblefin", "Prince Puddlesworth", "Baron Bubbletoes", "Viscount Vaseline-fin", "Captain Crunchfin", "Skipper Scalywag", "First Mate Finley", "Boatswain Barnaclejack", "Navigator Newt", "Honest Herring Abe", "Lucky Loach Lou", "Jumpy Jack the Minnow", "Grumpy Gus Grouper", "Wild Willy Walleye", "Dapper Dan the Danio", "Snazzy Sam the Snapper", "Zesty Zelda Zander", "Mellow Mo the Molly", "Spunky Spike the Spearfish",
];

export const TAGGED = {
  toothy: [
  "chompy", "bitey", "fangsome", "snaggletooth", "nibbler", "munchkin", "gnashers", "razorjaw", "chewy", "biteback", "snapperjaw", "toothsome", "fangface", "chopper", "grinder",
],
  noodle: [
  "noodle", "spaghetti", "wiggle", "ribbon", "slink", "slither", "elongated", "stringy", "wavy", "squiggle", "eelish", "sinuous", "serpentine", "whipcord", "floppy",
],
  chonk: [
  "chonky", "rotund", "dumpling", "plump", "portlyfin", "blobby", "podgy", "barrel", "puffball", "tubby", "butterball", "roundabout", "squishball", "meatball",
],
  spiky: [
  "spiky", "venomous", "barbed", "quillback", "needlefin", "thornback", "prickleback", "spinejab", "porcupinefin", "bristly", "jaggededge", "pointyback", "spur", "stinger",
],
  glowy: [
  "glowy", "bioluminous", "neonfin", "firefly", "sparkler", "lumen", "radiant", "phosphor", "glowstick", "beacon", "luminary", "nightlight", "starlit", "flicker", "moonglow",
],
  fancy: [
  "fancyfin", "veiltail", "flowy", "gossamer", "elegant", "plumed", "ribboned", "trailing", "ornate", "regalfin", "silkentail", "drapedfin", "glamorous", "frilly", "ballgown",
],
  grumpy: [
  "grumpy", "scowler", "frowny", "crabby", "sourface", "grouch", "crank", "sulky", "surly", "growly", "moody", "peeved", "snippy", "huffy", "cross",
],
  tiny: [
  "tiny", "teeny", "miniature", "pocketsize", "petite", "wee", "micro", "dinky", "thumbsize", "smidgen", "minuscule", "diminutive", "peewee",
],
  giant: [
  "giant", "colossal", "gargantuan", "massive", "titanic", "behemoth", "hulking", "mammoth", "monstrous", "jumbo", "enormous", "leviathan", "oversized", "hefty", "whopping",
],
  ghost: [
  "ghostly", "phantom", "translucent", "albino", "pale", "spectral", "wraithlike", "seethrough", "misty", "faded", "ethereal", "vaporous", "blanched", "hollow", "wisplike",
],
  shiny: [
  "shiny", "chrome", "iridescent", "rainbow", "metallic", "glossy", "mirrorscale", "glittery", "gleaming", "polished", "lustrous", "prismatic", "holographic", "sparkling", "luminescent",
],
  dark: [
  "melanistic", "galaxy", "inky", "shadowed", "obsidian", "midnight", "onyx", "charcoal", "noir", "umbral", "sooty", "jetblack", "eclipsed", "gloomy", "blackened",
],
  hybrid: [
  "frankenfin", "mashup", "mixbreed", "splice", "crossbred", "chimera", "patchwork", "amalgam", "mongrelfin", "fusionfish", "hodgepodge", "blendling", "mutt", "grafted", "composite",
],
};
