const fs = require('fs');

// Read world book and new entries
const data = JSON.parse(fs.readFileSync('.playwright-mcp/艾瑟兰大陆：异世界大冒险.json', 'utf8'));
const newEntries = JSON.parse(fs.readFileSync('new-entries.json', 'utf8'));
const darkMagic = JSON.parse(fs.readFileSync('dark-magic.json', 'utf8'));
const waterMagic = JSON.parse(fs.readFileSync('water-magic.json', 'utf8'));
const fireMagic = JSON.parse(fs.readFileSync('fire-magic.json', 'utf8'));
const windMagic = JSON.parse(fs.readFileSync('wind-magic.json', 'utf8'));

// Remove junk entries (UID 17-21)
[17, 18, 19, 20, 21].forEach(uid => delete data.entries[String(uid)]);

// Fix 光系魔法 keys
if (data.entries['15']) {
  data.entries['15'].key = ['光', '光系', '光魔法', '神圣', '奥拉斯特', '治愈', '光明', '审判', '净化', '祝福', '圣光', '圣疗', '圣盾'];
  data.entries['15'].order = 36;
}

// Clone template from an existing keyword entry
const template = JSON.parse(JSON.stringify(Object.values(data.entries).find(e => !e.constant && e.selective)));

function makeEntry(uid, info) {
  const e = JSON.parse(JSON.stringify(template));
  e.uid = uid;
  e.comment = info.comment;
  e.key = info.key;
  e.keysecondary = [];
  e.content = info.content;
  e.order = info.order;
  e.constant = info.constant || false;
  e.selective = true;
  e.selectiveLogic = 0;
  e.addMemo = true;
  e.position = 0;
  e.disable = false;
  e.ignoreBudget = false;
  e.excludeRecursion = true;
  e.preventRecursion = true;
  e.delayUntilRecursion = false;
  e.probability = 100;
  e.useProbability = true;
  e.depth = 4;
  e.group = '';
  e.groupOverride = false;
  e.groupWeight = 100;
  e.sticky = 0;
  e.cooldown = 0;
  e.delay = 0;
  e.outletName = '';
  e.automationId = '';
  e.matchPersonaDescription = false;
  e.matchCharacterDescription = false;
  e.matchCharacterPersonality = false;
  e.matchCharacterDepthPrompt = false;
  e.matchScenario = false;
  e.matchCreatorNotes = false;
  e.role = null;
  e.scanDepth = null;
  e.caseSensitive = null;
  e.matchWholeWords = null;
  e.useGroupScoring = false;
  e.triggers = [];
  e.displayIndex = 3;
  e.characterFilter = { isExclude: false, names: [], tags: [] };
  return e;
}

let uid = 22;
const allNew = [
  newEntries['魔法系统总纲'],
  newEntries['天赋设定'],
  darkMagic,
  waterMagic,
  fireMagic,
  windMagic
];

allNew.forEach(info => {
  data.entries[String(uid)] = makeEntry(uid, info);
  uid++;
});

fs.writeFileSync('.playwright-mcp/艾瑟兰大陆：异世界大冒险_fixed.json', JSON.stringify(data));
console.log('Done! Total entries:', Object.keys(data.entries).length);
Object.values(data.entries).forEach(e => console.log('  UID', e.uid, '|', e.comment, '| order', e.order));
