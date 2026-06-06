/**
 * 回合制自动战斗扩展 — 酒馆战棋风格
 * 基于艾瑟兰战斗系统
 */

import { extension_settings, getContext, renderExtensionTemplateAsync } from '../../extensions.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from '../../slash-commands/SlashCommandArgument.js';

// ==================== 战斗引擎 ====================

/** 掷骰子判定命中 */
function rollHit(attackerAgi, defenderAgi) {
    const hitRate = Math.min(0.95, Math.max(0.05, 0.85 + (attackerAgi - defenderAgi) * 0.02));
    const roll = Math.random();
    return { hit: roll <= hitRate, hitRate: Math.round(hitRate * 100), roll: Math.round(roll * 100) };
}

/** 计算物理伤害 */
function calcDamage(attackerStr, weaponBaseMin = 5, weaponBaseMax = 15) {
    const baseDamage = weaponBaseMin + Math.random() * (weaponBaseMax - weaponBaseMin);
    const physCoeff = 1 + attackerStr * 0.1;
    return Math.round(baseDamage * physCoeff);
}

/** 深拷贝单位 */
function cloneUnit(u) {
    return { ...u, hp: u.hp, maxHp: u.maxHp };
}

/** 运行完整战斗（纯逻辑，不操作 DOM） */
function runBattle(myTeamRaw, enemyTeamRaw, onEvent) {
    const myTeam = myTeamRaw.map(cloneUnit);
    const enemyTeam = enemyTeamRaw.map(cloneUnit);

    let round = 0;

    const logEvent = (type, msg, data = {}) => {
        if (onEvent) onEvent({ type, msg, round, ...data });
    };

    while (myTeam.some(u => u.hp > 0) && enemyTeam.some(u => u.hp > 0)) {
        round++;

        // === 我方回合 ===
        const myAlive = myTeam.filter(u => u.hp > 0);
        for (const attacker of myAlive) {
            if (enemyTeam.every(u => u.hp <= 0)) break;
            const targetPool = enemyTeam.filter(u => u.hp > 0);
            const target = targetPool[Math.floor(Math.random() * targetPool.length)];

            const { hit, hitRate, roll } = rollHit(attacker.agi, target.agi);
            if (hit) {
                const dmg = calcDamage(attacker.str);
                target.hp = Math.max(0, target.hp - dmg);
                logEvent('attack', `[${attacker.name}] 攻击 [${target.name}]，命中率 ${hitRate}%，造成 ${dmg} 点伤害！`, {
                    attacker: attacker.name,
                    attackerIcon: attacker.icon,
                    target: target.name,
                    targetIcon: target.icon,
                    hitRate,
                    roll,
                    damage: dmg,
                    targetHp: target.hp,
                    targetMaxHp: target.maxHp,
                    side: 'my',
                });
            } else {
                logEvent('miss', `[${attacker.name}] 攻击 [${target.name}]，命中率 ${hitRate}%，投出 ${roll}——未命中！`, {
                    attacker: attacker.name,
                    attackerIcon: attacker.icon,
                    target: target.name,
                    targetIcon: target.icon,
                    hitRate,
                    roll,
                    side: 'my',
                });
            }
        }

        // === 敌方回合 ===
        const enemyAlive = enemyTeam.filter(u => u.hp > 0);
        for (const attacker of enemyAlive) {
            if (myTeam.every(u => u.hp <= 0)) break;
            const targetPool = myTeam.filter(u => u.hp > 0);
            const target = targetPool[Math.floor(Math.random() * targetPool.length)];

            const { hit, hitRate, roll } = rollHit(attacker.agi, target.agi);
            if (hit) {
                const dmg = calcDamage(attacker.str);
                target.hp = Math.max(0, target.hp - dmg);
                logEvent('attack', `[${attacker.name}] 攻击 [${target.name}]，命中率 ${hitRate}%，造成 ${dmg} 点伤害！`, {
                    attacker: attacker.name,
                    attackerIcon: attacker.icon,
                    target: target.name,
                    targetIcon: target.icon,
                    hitRate,
                    roll,
                    damage: dmg,
                    targetHp: target.hp,
                    targetMaxHp: target.maxHp,
                    side: 'enemy',
                });
            } else {
                logEvent('miss', `[${attacker.name}] 攻击 [${target.name}]，命中率 ${hitRate}%，投出 ${roll}——未命中！`, {
                    attacker: attacker.name,
                    attackerIcon: attacker.icon,
                    target: target.name,
                    targetIcon: target.icon,
                    hitRate,
                    roll,
                    side: 'enemy',
                });
            }
        }
    }

    const myAlive = myTeam.filter(u => u.hp > 0).length;
    const enemyAlive = enemyTeam.filter(u => u.hp > 0).length;
    const victory = myAlive > 0 && enemyAlive === 0;

    logEvent('end', victory ? '🎉 战斗胜利！我方全歼敌军！' : '💀 战斗失败！我方全军覆没……', { victory, myAlive, enemyAlive, totalRounds: round });

    return { victory, myTeam, enemyTeam, rounds: round };
}

// ==================== 默认阵容 ====================

const DEFAULT_TEAMS = {
    my: [
        { name: '矮人战士', str: 14, agi: 9, con: 14, hp: 140, maxHp: 140, icon: '🪓' },
        { name: '精灵游侠', str: 12, agi: 14, con: 7, hp: 70, maxHp: 70, icon: '🏹' },
    ],
    enemy: [
        { name: '兽人掠夺者', str: 15, agi: 8, con: 12, hp: 120, maxHp: 120, icon: '👹' },
        { name: '狼人斥候', str: 13, agi: 12, con: 10, hp: 100, maxHp: 100, icon: '🐺' },
    ],
};

// ==================== 设置 ====================

const SETTINGS_KEY = 'auto_battle';

function getSettings() {
    if (!extension_settings[SETTINGS_KEY]) {
        extension_settings[SETTINGS_KEY] = {
            myTeam: JSON.parse(JSON.stringify(DEFAULT_TEAMS.my)),
            enemyTeam: JSON.parse(JSON.stringify(DEFAULT_TEAMS.enemy)),
        };
    }
    return extension_settings[SETTINGS_KEY];
}

// ==================== UI 生成 ====================

let battlePanel = null;
let battleLogEntries = [];
let battleRunning = false;
let currentBattleState = null; // { myTeam, enemyTeam }

function createBattlePanel() {
    if (battlePanel) return battlePanel;

    const html = `
    <div id="auto-battle-panel" class="auto-battle-panel">
        <div class="ab-header">
            <span class="ab-title">⚔️ 回合制自动战斗</span>
            <div class="ab-header-btns">
                <button class="ab-btn-settings" title="阵容设置">⚙️</button>
                <button class="ab-btn-minimize" title="最小化">─</button>
                <button class="ab-btn-close" title="关闭">✕</button>
            </div>
        </div>

        <div class="ab-battlefield">
            <!-- 我方 -->
            <div class="ab-side ab-my-side">
                <div class="ab-side-label">🛡️ 我方</div>
                <div id="ab-my-units" class="ab-units"></div>
            </div>

            <!-- 中间 VS -->
            <div class="ab-vs">
                <div class="ab-vs-text">⚡VS⚡</div>
                <button id="ab-btn-start" class="ab-btn-start">开始战斗</button>
                <button id="ab-btn-reset" class="ab-btn-reset" style="display:none">重置/再战</button>
                <div id="ab-result" class="ab-result"></div>
            </div>

            <!-- 敌方 -->
            <div class="ab-side ab-enemy-side">
                <div class="ab-side-label">💀 敌方</div>
                <div id="ab-enemy-units" class="ab-units"></div>
            </div>
        </div>

        <!-- 战斗日志 -->
        <div class="ab-log-container">
            <div class="ab-log-header">📜 战斗日志</div>
            <div id="ab-log" class="ab-log"></div>
        </div>

        <!-- 设置面板（默认隐藏） -->
        <div id="ab-settings" class="ab-settings" style="display:none">
            <div class="ab-settings-header">阵容设置</div>
            <div class="ab-settings-body">
                <div class="ab-team-editor">
                    <h4>🛡️ 我方阵容</h4>
                    <div id="ab-my-editor"></div>
                    <button class="ab-add-unit" data-side="my">+ 添加我方单位</button>
                </div>
                <div class="ab-team-editor">
                    <h4>💀 敌方阵容</h4>
                    <div id="ab-enemy-editor"></div>
                    <button class="ab-add-unit" data-side="enemy">+ 添加敌方单位</button>
                </div>
                <button id="ab-save-settings" class="ab-btn-save">保存设置</button>
            </div>
        </div>
    </div>`;

    // 注入到 body
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container.firstElementChild);

    battlePanel = document.getElementById('auto-battle-panel');
    bindPanelEvents();
    renderUnits();
    return battlePanel;
}

/** 渲染单位卡片 */
function renderUnits() {
    const settings = getSettings();
    renderTeamUnits('ab-my-units', settings.myTeam);
    renderTeamUnits('ab-enemy-units', settings.enemyTeam);
}

function renderTeamUnits(containerId, team) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = team.map((u, i) => {
        const hpPercent = u.maxHp > 0 ? Math.round((u.hp / u.maxHp) * 100) : 0;
        const hpColor = hpPercent > 50 ? 'var(--ab-hp-green, #4caf50)' :
                        hpPercent > 25 ? 'var(--ab-hp-yellow, #ff9800)' :
                        'var(--ab-hp-red, #f44336)';
        return `
        <div class="ab-unit-card ${u.hp <= 0 ? 'dead' : ''}" data-index="${i}" data-name="${u.name}" data-hp="${u.hp}">
            <div class="ab-unit-icon">${u.icon || '⚔️'}</div>
            <div class="ab-unit-name">${u.name}</div>
            <div class="ab-unit-hp-bar">
                <div class="ab-unit-hp-fill" style="width:${hpPercent}%; background:${hpColor}"></div>
            </div>
            <div class="ab-unit-hp-text">${u.hp}/${u.maxHp}</div>
            <div class="ab-unit-stats">
                <span title="力量">💪${u.str}</span>
                <span title="敏捷">💨${u.agi}</span>
                <span title="体质">❤️${u.con}</span>
            </div>
        </div>`;
    }).join('');
}

/** 绑定事件 */
function bindPanelEvents() {
    if (!battlePanel) return;

    // 关闭
    battlePanel.querySelector('.ab-btn-close')?.addEventListener('click', () => {
        battlePanel.remove();
        battlePanel = null;
    });

    // 最小化
    battlePanel.querySelector('.ab-btn-minimize')?.addEventListener('click', () => {
        const body = battlePanel.querySelector('.ab-battlefield');
        const log = battlePanel.querySelector('.ab-log-container');
        if (body) body.style.display = body.style.display === 'none' ? '' : 'none';
        if (log) log.style.display = log.style.display === 'none' ? '' : 'none';
    });

    // 设置
    battlePanel.querySelector('.ab-btn-settings')?.addEventListener('click', () => {
        const settingsEl = document.getElementById('ab-settings');
        if (settingsEl) {
            const visible = settingsEl.style.display !== 'none';
            settingsEl.style.display = visible ? 'none' : 'block';
            if (!visible) renderSettingsEditor();
        }
    });

    // 保存设置
    battlePanel.querySelector('#ab-save-settings')?.addEventListener('click', saveSettings);

    // 开始战斗
    battlePanel.querySelector('#ab-btn-start')?.addEventListener('click', startBattle);

    // 重置
    battlePanel.querySelector('#ab-btn-reset')?.addEventListener('click', resetBattle);

    // 添加单位
    battlePanel.querySelectorAll('.ab-add-unit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const side = e.target.dataset.side;
            addUnitToTeam(side);
        });
    });
}

/** 渲染设置编辑器 */
function renderSettingsEditor() {
    const settings = getSettings();
    renderTeamEditor('ab-my-editor', settings.myTeam, 'my');
    renderTeamEditor('ab-enemy-editor', settings.enemyTeam, 'enemy');
    // 重新绑定添加按钮
    document.querySelectorAll('.ab-add-unit').forEach(btn => {
        btn.onclick = (e) => addUnitToTeam(e.target.dataset.side);
    });
}

function renderTeamEditor(containerId, team, side) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = team.map((u, i) => `
        <div class="ab-unit-editor-row">
            <input class="ab-edit-name" value="${u.name}" placeholder="名称" data-side="${side}" data-idx="${i}" data-field="name">
            <input class="ab-edit-icon" value="${u.icon || ''}" placeholder="图标" data-side="${side}" data-idx="${i}" data-field="icon" style="width:40px">
            <input class="ab-edit-stat" type="number" value="${u.str}" placeholder="力量" data-side="${side}" data-idx="${i}" data-field="str" title="力量">
            <input class="ab-edit-stat" type="number" value="${u.agi}" placeholder="敏捷" data-side="${side}" data-idx="${i}" data-field="agi" title="敏捷">
            <input class="ab-edit-stat" type="number" value="${u.con}" placeholder="体质" data-side="${side}" data-idx="${i}" data-field="con" title="体质">
            <input class="ab-edit-stat" type="number" value="${u.maxHp}" placeholder="HP" data-side="${side}" data-idx="${i}" data-field="maxHp" title="最大HP">
            <button class="ab-remove-unit" data-side="${side}" data-idx="${i}">✕</button>
        </div>
    `).join('');

    // 绑定删除按钮
    container.querySelectorAll('.ab-remove-unit').forEach(btn => {
        btn.onclick = (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const s = e.target.dataset.side;
            const st = getSettings();
            st[s + 'Team'].splice(idx, 1);
            renderSettingsEditor();
        };
    });

    // 绑定修改事件
    container.querySelectorAll('input').forEach(input => {
        input.onchange = (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const field = e.target.dataset.field;
            const s = e.target.dataset.side;
            const val = e.target.value;
            const st = getSettings();
            const unit = st[s + 'Team'][idx];
            if (!unit) return;
            if (field === 'name' || field === 'icon') {
                unit[field] = val;
            } else {
                unit[field] = parseInt(val) || 0;
            }
            if (field === 'maxHp') unit.hp = unit.maxHp;
        };
    });
}

function addUnitToTeam(side) {
    const st = getSettings();
    st[side + 'Team'].push({ name: '新单位', str: 10, agi: 10, con: 10, hp: 100, maxHp: 100, icon: '⚔️' });
    renderSettingsEditor();
}

function saveSettings() {
    // Settings are already updated via onchange handlers in the editor
    // Just re-read and save
    const st = getSettings();
    // Sync hp with maxHp
    st.myTeam.forEach(u => { if (u.hp > u.maxHp) u.hp = u.maxHp; });
    st.enemyTeam.forEach(u => { if (u.hp > u.maxHp) u.hp = u.maxHp; });
    resetBattle();
    document.getElementById('ab-settings').style.display = 'none';
}

// ==================== 战斗控制 ====================

async function startBattle() {
    if (battleRunning) return;

    const settings = getSettings();
    // 重置所有单位HP
    settings.myTeam.forEach(u => u.hp = u.maxHp);
    settings.enemyTeam.forEach(u => u.hp = u.maxHp);

    const btnStart = document.getElementById('ab-btn-start');
    const btnReset = document.getElementById('ab-btn-reset');
    const resultEl = document.getElementById('ab-result');
    const logEl = document.getElementById('ab-log');

    if (btnStart) btnStart.style.display = 'none';
    if (btnReset) btnReset.style.display = 'none';
    if (resultEl) resultEl.innerHTML = '';
    if (logEl) logEl.innerHTML = '';

    battleLogEntries = [];
    battleRunning = true;
    currentBattleState = {
        myTeam: settings.myTeam.map(cloneUnit),
        enemyTeam: settings.enemyTeam.map(cloneUnit),
    };

    renderUnits();
    appendLog('⚡ 战斗开始！', 'system');

    // 使用 setTimeout 驱动战斗动画
    const events = [];
    runBattle(settings.myTeam, settings.enemyTeam, (evt) => {
        events.push(evt);
    });

    for (let i = 0; i < events.length; i++) {
        if (!battleRunning) break;
        const evt = events[i];

        if (evt.type === 'attack' || evt.type === 'miss') {
            // 更新状态
            if (evt.side === 'my') {
                const target = currentBattleState.enemyTeam.find(u => u.name === evt.target);
                if (target) {
                    target.hp = evt.targetHp !== undefined ? evt.targetHp : target.hp;
                }
            } else {
                const target = currentBattleState.myTeam.find(u => u.name === evt.target);
                if (target) {
                    target.hp = evt.targetHp !== undefined ? evt.targetHp : target.hp;
                }
            }

            // 高亮动画
            highlightUnit(evt.attacker, evt.target, evt.type === 'attack');

            // 更新 UI
            renderUnits();
            appendLog(evt.msg, evt.type === 'attack' ? 'hit' : 'miss');

            await sleep(600);
        } else if (evt.type === 'end') {
            currentBattleState = null;
            appendLog(evt.msg, evt.victory ? 'victory' : 'defeat');
            if (resultEl) {
                resultEl.innerHTML = evt.victory ?
                    '<span class="ab-victory">🎉 胜利！</span>' :
                    '<span class="ab-defeat">💀 失败！</span>';
            }
            if (btnReset) btnReset.style.display = '';
        }
    }

    battleRunning = false;
}

function resetBattle() {
    battleRunning = false;
    currentBattleState = null;
    const settings = getSettings();
    settings.myTeam.forEach(u => u.hp = u.maxHp);
    settings.enemyTeam.forEach(u => u.hp = u.maxHp);

    const btnStart = document.getElementById('ab-btn-start');
    const btnReset = document.getElementById('ab-btn-reset');
    const resultEl = document.getElementById('ab-result');
    const logEl = document.getElementById('ab-log');

    if (btnStart) btnStart.style.display = '';
    if (btnReset) btnReset.style.display = 'none';
    if (resultEl) resultEl.innerHTML = '';
    if (logEl) logEl.innerHTML = '';

    battleLogEntries = [];
    renderUnits();
}

function highlightUnit(attackerName, targetName, isHit) {
    // 高亮攻击方
    document.querySelectorAll('.ab-unit-card').forEach(card => {
        const name = card.dataset.name;
        if (name === attackerName) {
            card.classList.add(isHit ? 'ab-attacking' : 'ab-missing');
            setTimeout(() => card.classList.remove('ab-attacking', 'ab-missing'), 400);
        }
        if (name === targetName) {
            card.classList.add(isHit ? 'ab-hit' : 'ab-missed');
            if (isHit) {
                card.classList.add('ab-shake');
                setTimeout(() => card.classList.remove('ab-shake'), 500);
            }
            setTimeout(() => card.classList.remove('ab-hit', 'ab-missed'), 600);
        }
    });
}

function appendLog(msg, type = 'info') {
    battleLogEntries.push({ msg, type });
    const logEl = document.getElementById('ab-log');
    if (!logEl) return;

    const entry = document.createElement('div');
    entry.className = `ab-log-entry ab-log-${type}`;
    entry.textContent = msg;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== 斜杠命令 ====================

function registerSlashCommands() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'auto-battle',
        aliases: ['ab', '战斗'],
        callback: (_args, _value) => {
            const panel = createBattlePanel();
            if (panel) {
                // 拖动支持
                enableDrag(panel);
            }
            return '';
        },
        helpString: '打开回合制自动战斗面板',
        returns: '',
        namedArgumentList: [],
    }));
}

/** 简易拖动 */
function enableDrag(panel) {
    const header = panel.querySelector('.ab-header');
    if (!header) return;
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.style.cursor = 'move';
    header.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = panel.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        panel.style.position = 'fixed';
        panel.style.left = startLeft + 'px';
        panel.style.top = startTop + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        panel.style.left = (startLeft + dx) + 'px';
        panel.style.top = (startTop + dy) + 'px';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

// ==================== 插件入口 ====================

jQuery(async () => {
    console.log('[AutoBattle] 回合制自动战斗扩展加载中...');

    // 注册斜杠命令
    registerSlashCommands();

    // 注入 CSS（内联备用，确保样式有效）
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = '/scripts/extensions/third-party/auto-battle/style.css';
    document.head.appendChild(cssLink);

    console.log('[AutoBattle] ✅ 扩展已就绪！输入 /auto-battle 打开战斗面板');
});
