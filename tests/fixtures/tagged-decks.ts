import decks from './collection-decks.json' with { type: 'json' };

// The fixture decks are copies on Archidekt, and copying a deck drops its tags.
// Specs about tags use these, the tags the original precons carried.
const tags = [
  ['Angels', 'Flying', 'Lifegain', 'Tribal'], ['Dragons', 'Flying', 'Burn', 'Tribal'], ['Stompy', 'Power Matters', 'Tribal'],
  ['Thopters', 'Artifacts', 'Draw', 'Tribal', 'Tokens'], ['Graveyard', 'Zombies', 'Lifedrain', 'Sacrifice', 'Tribal'],
  ['Polymorph', 'ETB Effects', 'Historic', 'Tokens'], ['Heroes', '+1/+1 Counters', 'Voltron'], ['Spellslinger'],
  ['Villains', 'Connive', 'Aristocrat'], ['Artifacts', 'Monarch', 'Ramp', 'Tokens'], ['+1/+1 Counters', 'Big Mana', 'Ramp'],
  ['Auras', 'Enchantments', 'Pillow Fort', 'Enchantress'], ['Lifegain', 'Tokens', 'Sacrifice'],
  ['Flashback', 'Graveyard', 'Self-Mill', 'Spirits', 'Reanimator'], ['Spellslinger', 'Tokens', 'Big Mana'],
  ['+1/+1 Counters', 'Historic', 'Ninjutsu', 'Turtles', 'Mutants', 'Tokens'], ['-1/-1 Counters', 'Reanimator', 'Control'],
  ['Elementals', 'Tribal', 'Ramp'], ['Dredge', 'Self-Mill', 'Graveyard', 'Lands Matter', 'Sacrifice', 'Reanimator', 'Land'],
  ['Proliferate', 'Artifacts', 'Counters'], ['+1/+1 Counters', 'Ramp'], ['Spellslinger', 'Historic', 'Lifegain'],
  ['Graveyard', 'Reanimator', 'Self-Mill', 'Aggro'], ['Equipment', 'Historic', 'Voltron'], ['Ramp', 'Tribal'],
  ['Reanimator', 'Mill'], ['Control', 'Lifegain', 'Aristocrat'], ['Aggro', 'Tokens', 'Sacrifice'], ['Spellslinger', 'Combo'],
];

export default decks.map((deck, index) => ({ ...deck, tags: tags[index] ?? [] }));
