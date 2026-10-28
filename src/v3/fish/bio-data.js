// Word pools for the v3 fish bio generator: a Tinder-profile-style blurb for each fish, picked by
// its looks and mood. Plain data only -- no logic. See bio.js (consumer) for how pools combine.
//
// Voice: first person, deadpan absurd, one beat per line, usually under ~12 words. `{body}` and
// `{Body}` are template tokens, swapped for the fish's body name (lower/capitalised) -- use them
// sparingly, only where a line reads naturally with its own species dropped in.
//
// GENERIC pools are the fallback for every fish and every category. TAGGED pools only fire for a
// fish that earns that tag (see bioTagsOf in bio.js), and even then they're picked over GENERIC
// only about 60% of the time, so a toothy fish leans toothy without always getting the same lines.
//
// Categories (the "beats" a pattern in bio.js can draw on):
//   opener      -- who this fish is, in one line
//   trait       -- a crack about its physical standout
//   personality -- mood, quirks, red/green flags
//   rumor       -- an absurd claim, achievement or backstory
//   closer      -- the tagline / call to action
//
// To add more lines: append to any pool below, matching its voice. A category needs no coverage
// for every tag -- a fish without that tag, or a tag with no entry in a category, just falls back
// to GENERIC for that category. This is the seed set Haiku should bulk-expand from.

export const GENERIC = {
  opener: [
    "{Body} by hatching, disaster by choice.",
    "Just a {body} trying to make it in this tank.",
    "Certified {body}. Uncertified good decision-maker.",
    "They call me a {body}. I prefer 'aquatic icon.'",
    "Not your average {body}.",
    "{Body}, but make it fashion.",
    "Living my best life, one bubble at a time.",
    "Still figuring out what a fin is for.",
    "Here for a good time, not a long swim.",
    "Professional bubble blower.",
    "Self-taught in the art of doing nothing.",
    "Looks like a snack, fights like a legend.",
    "Born in a tank. Raised by vibes.",
    "I contain multitudes. Mostly water.",
    "Résumé: exists. Swims. Occasionally impressive.",
    "Woke up one day and chose chaos. Still choosing.",
    "Speed-running the 'what not to do' guide for fish.",
    "Main character in my own movie. Plot is unclear.",
    "Started at the bottom, still at the bottom.",
    "They tried to name me something fierce. I'm vibing instead.",
    "Professional at looking busy, expert at doing nothing.",
    "Escaped the feeder fish pipeline through sheer stubbornness.",
    "Exists primarily to annoy my tankmates. Thriving.",
    "My therapist is a piece of gravel. It listens well.",
    "On a personal journey. The journey is very small.",
    "Upgraded from the goldfish bowl. Spiritually unchanged.",
    "Plot twist: I have no idea what I'm doing.",
    "Faking confidence since day one. It's working okay.",
    "Living proof that you don't need a plan to be here.",
    "They said I'd grow up. I'm still collecting pebbles.",
    "Accidentally made an enemy of a plant. Still sorry.",
    "The tank is my kingdom. It's a very wet kingdom.",
    "Achieving nothing, looking great doing it.",
    "Winging it harder than ever before.",
    "My autobiography would be titled 'what was I thinking?'",
    "Speed-running existential dread in a 5-gallon tank.",
  ],
  trait: [
    "Known for my stunning personality, since my face is doing its own thing.",
    "My silhouette has been described as 'bold.'",
    "I peaked physically at birth.",
    "These fins don't just look good, they also look good.",
    "Built different. Possibly built wrong.",
    "I was going for 'majestic.' Landed somewhere near 'odd.'",
    "My best angle is from very far away.",
    "Symmetrical, allegedly.",
    "I come with a face only a tankmate could love.",
    "Some assembly required.",
  ],
  personality: [
    "Red flags: I bite. Green flags: I also nap a lot.",
    "Low maintenance, except for the constant need for attention.",
    "Emotionally available, physically in a tank.",
    "I'm not clingy, I just also can't leave.",
    "Communicates mainly through bubbles and vibes.",
    "Great listener. Terrible at eye contact, for anatomical reasons.",
    "I have a complicated relationship with my reflection.",
    "Introvert on the outside, absolute menace on the inside.",
    "Will ghost you. Figuratively. Sometimes literally.",
    "My love language is circling you expectantly at feeding time.",
  ],
  rumor: [
    "Once beat a rock in a staring contest. The rock gave up first.",
    "Local legend says I invented the bubble.",
    "Rumor has it I used to be bigger. I was not.",
    "Allegedly banned from one (1) castle ornament.",
    "There's a whole subplot about me the other fish won't discuss.",
    "My ancestors crossed an ocean. I have crossed a 10-gallon tank, bravely.",
    "Survived a water change. Never fully recovered. Thriving anyway.",
    "Witnesses say I once looked directly at the camera. No photo exists.",
    "I have a tragic backstory I will not be elaborating on.",
    "Reportedly the reason feeding time is 'complicated' now.",
  ],
  closer: [
    "Swipe right if you also enjoy long swims to nowhere.",
    "Looking for someone who won't judge the bubbles.",
    "DM me. I mean, I can't read, but the gesture is nice.",
    "No drama. Unless it's about food.",
    "Must love fins.",
    "Not looking for anything serious. Also not capable of it.",
    "Tank included. Personality not optional.",
    "If you can't handle me at my derpiest, you don't deserve me at my also-derpiest.",
    "Swipe left if you're a heron.",
    "This bio was written under duress (hunger).",
  ],
};

export const TAGGED = {
  trait: {
    toothy: [
      "These teeth weren't optional, they were mandatory.",
      "Smile first, ask questions never.",
      "My dentist called. He's scared.",
      "Built-in cutlery, no reservations required.",
    ],
    noodle: [
      "I'm 90% length, 10% plan.",
      "Shaped like a decision I didn't think through.",
      "Technically a fish. Spiritually a ribbon.",
      "I move like a rumor: sideways and fast.",
    ],
    chonk: [
      "I'm not round, I'm fuel-efficient.",
      "Built like a dumpling with opinions.",
      "Big-boned. The bones are also round.",
      "I contain multitudes. And snacks.",
    ],
    spiky: [
      "Hug me and you'll regret it. We'll both know why.",
      "Came with spikes. No refunds.",
      "Pointy on the outside, also pointy on the inside.",
      "I'm basically a cactus that swims.",
    ],
    glowy: [
      "I light up a room. Also a tank. Mostly just myself.",
      "Built-in nightlight, zero batteries required.",
      "I glow because I have nothing to hide. Mostly water.",
    ],
    fancy: [
      "These fins took effort. Please acknowledge them.",
      "Overdressed for every occasion, including this one.",
      "I didn't choose the drama, the fins did.",
    ],
    tiny: [
      "Small, but my ego swims at full size.",
      "Pocket-sized menace.",
      "I may be tiny but I take up emotional space.",
    ],
    giant: [
      "They said I'd grow into my fins. I grew out of the tank instead.",
      "I'm less 'pet,' more 'local landmark.'",
      "Built to scale. The scale was wrong.",
    ],
    ghost: [
      "So pale I'm basically a rumor with fins.",
      "I'm see-through. Emotionally too.",
      "People say I'm hard to find. I say I'm just tasteful.",
    ],
    shiny: [
      "I catch light like I catch attention: constantly.",
      "Mirror finish, zero depth, incredible vibes.",
      "Shiny on purpose. The personality's extra.",
    ],
    dark: [
      "I come in one color: mysterious.",
      "Dressed for a funeral I'm not attending.",
      "Dark and moody, like my tankmate's decor choices.",
    ],
    scarred: [
      "This scar has a story. I'm not telling it.",
      "Battle-tested. The battle was a pebble.",
      "Every nick is a personality point.",
    ],
    wonky: [
      "Symmetry is a construct I rejected early.",
      "One side of me has a different plan than the other.",
      "Built slightly off-center, like most good ideas.",
    ],
  },
  personality: {
    grumpy: [
      "Resting fish face, permanently.",
      "I'm not mad. This is just my face.",
      "My default setting is 'leave me alone.'",
      "Mood: perpetually unimpressed.",
    ],
    happy: [
      "Unreasonably delighted by everything, including gravel.",
      "Main character energy, minor character budget.",
      "I find joy in bubbles. Don't overthink it.",
    ],
    sleepy: [
      "Running on a strict nap-then-nap schedule.",
      "Woke up, considered swimming, went back to floating.",
      "My spirit animal is a nap.",
    ],
    smug: [
      "I know something you don't. It's probably nothing.",
      "Confidence: 100%. Reason: unclear.",
      "I'd wink if I had the anatomy for it.",
    ],
    derpy: [
      "Running on vibes and a questionable sense of direction.",
      "I once swam into the same rock twice. On purpose, probably.",
      "My brain has one tab open and it's buffering.",
    ],
    content: [
      "No notes. Life's pretty good at the bottom of a tank.",
      "Easily satisfied, mostly by food and existing.",
      "Zen, but make it aquatic.",
    ],
    hybrid: [
      "Two fish walked into a lab. I'm the punchline.",
      "Part this, part that, fully unbothered.",
      "My family tree is more of a family Venn diagram.",
    ],
    fry: [
      "New here. Already causing chaos at a smaller scale.",
      "Technically a baby. Emotionally thirty.",
      "Still growing into my opinions.",
    ],
    elder: [
      "Been around. Seen things. Mostly gravel.",
      "Old enough to know better, too tired to care.",
      "I've outlived three decorations and a filter.",
    ],
  },
  opener: {
    hybrid: [
      "Proof that two wrongs can make a very interesting right.",
      "A little bit of this, a little bit of that, entirely my own thing.",
    ],
    fry: [
      "Freshly hatched and already overwhelmed.",
      "Day one on the job. The job is existing.",
    ],
    elder: [
      "Veteran of the tank. Decorated, mostly in algae.",
      "Older than your houseplants and more opinionated.",
    ],
    giant: [
      "They had to special-order my tank.",
      "I don't fit in small talk or small tanks.",
    ],
    tiny: [
      "Fun-sized and proud of it.",
      "Small enough to hide, too dramatic to bother.",
    ],
  },
  rumor: {
    toothy: [
      "Local rumor: I bit a decoration pirate ship. It never recovered.",
      "They say I smile with intent.",
    ],
    glowy: [
      "Some say I'm bioluminescent. I say I'm just built different.",
      "Legend has it I once lit up a whole dark corner by accident.",
    ],
    shiny: [
      "Rumor has it I was mistaken for a coin once. I did not correct them.",
      "They say I shine so hard the camera couldn't handle it.",
    ],
    dark: [
      "They whisper about me in the shallow end.",
      "Nobody's seen my full backstory. I prefer it that way.",
    ],
    hybrid: [
      "There's a lab somewhere that still isn't sure what happened.",
      "My origin story has footnotes.",
    ],
    ghost: [
      "Some say I'm not really there. Rude, but accurate some days.",
      "Legend says I once vanished mid-sentence.",
    ],
  },
  closer: {
    chonk: [
      "Must come with snacks, or be one.",
      "Swipe right if you also believe round is a body type and a mood.",
    ],
    spiky: [
      "Approach with caution. Or don't. I'm not your boss.",
      "Cuddling not recommended. Admiring, encouraged.",
    ],
    grumpy: [
      "Don't expect a smile. Expect consistency.",
      "If you need constant affection, swipe elsewhere.",
    ],
    glowy: [
      "Dim the lights. I'll handle the rest.",
      "Bring your own sunglasses.",
    ],
    fancy: [
      "Red carpet optional. I bring my own.",
      "Please admire the fins before anything else.",
    ],
  },
};
