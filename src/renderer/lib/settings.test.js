import { defaultSettings, mergeSettings, settingsSections } from './settings';

describe('settings', () => {
  describe('defaultSettings', () => {
    it('has theme setting', () => {
      expect(defaultSettings.theme).toBe('idec-dark');
    });

    it('has editor settings', () => {
      expect(defaultSettings.editor).toBeDefined();
      expect(defaultSettings.editor.fontSize).toBe(14);
      expect(defaultSettings.editor.tabSize).toBe(2);
      expect(defaultSettings.editor.fontLigatures).toBe(true);
      expect(defaultSettings.editor.minimap).toBe(true);
    });

    it('has terminal settings', () => {
      expect(defaultSettings.terminal).toBeDefined();
      expect(defaultSettings.terminal.fontSize).toBe(13);
      expect(defaultSettings.terminal.cursorBlink).toBe(true);
    });

    it('has panels settings', () => {
      expect(defaultSettings.panels).toBeDefined();
      expect(defaultSettings.panels.fileExplorerWidth).toBe(260);
      expect(defaultSettings.panels.terminalHeight).toBe(240);
    });

    it('has AI settings', () => {
      expect(defaultSettings.ai).toBeDefined();
      expect(defaultSettings.ai.provider).toBe('claude');
      expect(defaultSettings.ai.ollamaUrl).toBe('http://localhost:11434');
    });

    it('has files settings', () => {
      expect(defaultSettings.files).toBeDefined();
      expect(defaultSettings.files.exclude).toContain('node_modules');
      expect(defaultSettings.files.exclude).toContain('.git');
    });

    it('has keybindings settings', () => {
      expect(defaultSettings.keybindings).toBeDefined();
      expect(defaultSettings.keybindings.save).toBe('Cmd+S');
      expect(defaultSettings.keybindings.find).toBe('Cmd+F');
    });

    it('has workbench settings', () => {
      expect(defaultSettings.workbench).toBeDefined();
      expect(defaultSettings.workbench.sideBarLocation).toBe('left');
    });
  });

  describe('mergeSettings', () => {
    it('returns defaults when called with empty object', () => {
      const result = mergeSettings({});
      expect(result.theme).toBe('idec-dark');
      expect(result.editor.fontSize).toBe(14);
    });

    it('returns defaults when called with null', () => {
      const result = mergeSettings(null);
      expect(result.theme).toBe('idec-dark');
    });

    it('returns defaults when called with undefined', () => {
      const result = mergeSettings(undefined);
      expect(result.theme).toBe('idec-dark');
    });

    it('overrides theme when provided', () => {
      const result = mergeSettings({ theme: 'dracula' });
      expect(result.theme).toBe('dracula');
    });

    it('preserves setupComplete flag', () => {
      const result = mergeSettings({ setupComplete: true });
      expect(result.setupComplete).toBe(true);
    });

    it('preserves setupComplete as false', () => {
      const result = mergeSettings({ setupComplete: false });
      expect(result.setupComplete).toBe(false);
    });

    it('merges editor settings', () => {
      const result = mergeSettings({ editor: { fontSize: 16 } });
      expect(result.editor.fontSize).toBe(16);
      expect(result.editor.tabSize).toBe(2); // default preserved
    });

    it('merges terminal settings', () => {
      const result = mergeSettings({ terminal: { fontSize: 15 } });
      expect(result.terminal.fontSize).toBe(15);
      expect(result.terminal.cursorBlink).toBe(true); // default preserved
    });

    it('merges panels settings', () => {
      const result = mergeSettings({ panels: { terminalHeight: 300 } });
      expect(result.panels.terminalHeight).toBe(300);
      expect(result.panels.fileExplorerWidth).toBe(260); // default preserved
    });

    it('merges AI settings', () => {
      const result = mergeSettings({ ai: { provider: 'openai', claudeApiKey: 'test-key' } });
      expect(result.ai.provider).toBe('openai');
      expect(result.ai.claudeApiKey).toBe('test-key');
      expect(result.ai.ollamaUrl).toBe('http://localhost:11434'); // default preserved
    });

    it('merges files settings', () => {
      const result = mergeSettings({ files: { autoSave: 'afterDelay' } });
      expect(result.files.autoSave).toBe('afterDelay');
      expect(result.files.trimTrailingWhitespace).toBe(true); // default preserved
    });

    it('merges keybindings settings', () => {
      const result = mergeSettings({ keybindings: { save: 'Ctrl+S' } });
      expect(result.keybindings.save).toBe('Ctrl+S');
      expect(result.keybindings.find).toBe('Cmd+F'); // default preserved
    });

    it('merges workbench settings', () => {
      const result = mergeSettings({ workbench: { showTabs: false } });
      expect(result.workbench.showTabs).toBe(false);
      expect(result.workbench.sideBarLocation).toBe('left'); // default preserved
    });

    // Legacy support tests
    it('supports legacy fontSize at root level', () => {
      const result = mergeSettings({ fontSize: 18 });
      expect(result.editor.fontSize).toBe(18);
    });

    it('supports legacy claudeApiKey at root level', () => {
      const result = mergeSettings({ claudeApiKey: 'sk-ant-test' });
      expect(result.ai.claudeApiKey).toBe('sk-ant-test');
    });

    it('supports legacy openaiApiKey at root level', () => {
      const result = mergeSettings({ openaiApiKey: 'sk-test' });
      expect(result.ai.openaiApiKey).toBe('sk-test');
    });

    it('supports legacy groqApiKey at root level', () => {
      const result = mergeSettings({ groqApiKey: 'gsk_test' });
      expect(result.ai.groqApiKey).toBe('gsk_test');
    });

    it('supports legacy ollamaUrl at root level', () => {
      const result = mergeSettings({ ollamaUrl: 'http://custom:11434' });
      expect(result.ai.ollamaUrl).toBe('http://custom:11434');
    });

    it('supports legacy ollamaCloudApiKey at root level', () => {
      const result = mergeSettings({ ollamaCloudApiKey: 'ollama-test' });
      expect(result.ai.ollamaCloudApiKey).toBe('ollama-test');
    });

    it('supports legacy openrouterApiKey at root level', () => {
      const result = mergeSettings({ openrouterApiKey: 'sk-or-test' });
      expect(result.ai.openrouterApiKey).toBe('sk-or-test');
    });

    it('supports legacy provider at root level', () => {
      const result = mergeSettings({ provider: 'groq' });
      expect(result.ai.provider).toBe('groq');
    });
  });

  describe('settingsSections', () => {
    it('has correct sections', () => {
      expect(settingsSections).toHaveLength(6);
    });

    it('has appearance section', () => {
      const section = settingsSections.find(s => s.id === 'appearance');
      expect(section).toBeDefined();
      expect(section.label).toBe('Appearance');
    });

    it('has editor section', () => {
      const section = settingsSections.find(s => s.id === 'editor');
      expect(section).toBeDefined();
      expect(section.label).toBe('Editor');
    });

    it('has terminal section', () => {
      const section = settingsSections.find(s => s.id === 'terminal');
      expect(section).toBeDefined();
      expect(section.label).toBe('Terminal');
    });

    it('has ai section', () => {
      const section = settingsSections.find(s => s.id === 'ai');
      expect(section).toBeDefined();
      expect(section.label).toBe('AI Providers');
    });

    it('has files section', () => {
      const section = settingsSections.find(s => s.id === 'files');
      expect(section).toBeDefined();
      expect(section.label).toBe('Files');
    });

    it('has keybindings section', () => {
      const section = settingsSections.find(s => s.id === 'keybindings');
      expect(section).toBeDefined();
      expect(section.label).toBe('Keyboard');
    });

    it('all sections have required fields', () => {
      settingsSections.forEach(section => {
        expect(section.id).toBeDefined();
        expect(section.label).toBeDefined();
        expect(section.icon).toBeDefined();
        expect(section.description).toBeDefined();
      });
    });
  });
});
