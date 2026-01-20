import { themes, createMonacoTheme, applyTheme } from './themes';

describe('themes', () => {
  describe('theme definitions', () => {
    it('has idec-dark theme', () => {
      expect(themes['idec-dark']).toBeDefined();
      expect(themes['idec-dark'].name).toBe('IDEC Dark');
      expect(themes['idec-dark'].type).toBe('dark');
    });

    it('has idec-light theme', () => {
      expect(themes['idec-light']).toBeDefined();
      expect(themes['idec-light'].name).toBe('IDEC Light');
      expect(themes['idec-light'].type).toBe('light');
    });

    it('has monokai theme', () => {
      expect(themes['monokai']).toBeDefined();
      expect(themes['monokai'].name).toBe('Monokai');
    });

    it('has dracula theme', () => {
      expect(themes['dracula']).toBeDefined();
      expect(themes['dracula'].name).toBe('Dracula');
    });

    it('has github-dark theme', () => {
      expect(themes['github-dark']).toBeDefined();
      expect(themes['github-dark'].name).toBe('GitHub Dark');
    });

    it('has one-dark theme', () => {
      expect(themes['one-dark']).toBeDefined();
      expect(themes['one-dark'].name).toBe('One Dark Pro');
    });

    it('has solarized-dark theme', () => {
      expect(themes['solarized-dark']).toBeDefined();
      expect(themes['solarized-dark'].name).toBe('Solarized Dark');
    });

    it('has nord theme', () => {
      expect(themes['nord']).toBeDefined();
      expect(themes['nord'].name).toBe('Nord');
    });

    it('has high-contrast theme', () => {
      expect(themes['high-contrast']).toBeDefined();
      expect(themes['high-contrast'].name).toBe('High Contrast');
    });

    it('all themes have required color properties', () => {
      Object.values(themes).forEach(theme => {
        expect(theme.colors).toBeDefined();
        expect(theme.colors.background).toBeDefined();
        expect(theme.colors.foreground).toBeDefined();
        expect(theme.colors.primary).toBeDefined();
        expect(theme.colors.secondary).toBeDefined();
        expect(theme.colors.border).toBeDefined();
      });
    });

    it('all themes have editor properties', () => {
      Object.values(themes).forEach(theme => {
        expect(theme.editor).toBeDefined();
        expect(theme.editor.background).toBeDefined();
        expect(theme.editor.foreground).toBeDefined();
        expect(theme.editor.cursor).toBeDefined();
      });
    });

    it('all themes have syntax properties', () => {
      Object.values(themes).forEach(theme => {
        expect(theme.syntax).toBeDefined();
        expect(theme.syntax.comment).toBeDefined();
        expect(theme.syntax.keyword).toBeDefined();
        expect(theme.syntax.string).toBeDefined();
        expect(theme.syntax.function).toBeDefined();
      });
    });
  });

  describe('createMonacoTheme', () => {
    it('creates dark theme with vs-dark base', () => {
      const monacoTheme = createMonacoTheme(themes['idec-dark']);
      expect(monacoTheme.base).toBe('vs-dark');
      expect(monacoTheme.inherit).toBe(true);
    });

    it('creates light theme with vs base', () => {
      const monacoTheme = createMonacoTheme(themes['idec-light']);
      expect(monacoTheme.base).toBe('vs');
      expect(monacoTheme.inherit).toBe(true);
    });

    it('creates rules for syntax highlighting', () => {
      const monacoTheme = createMonacoTheme(themes['dracula']);
      expect(monacoTheme.rules).toBeDefined();
      expect(monacoTheme.rules.length).toBeGreaterThan(0);
      
      const commentRule = monacoTheme.rules.find(r => r.token === 'comment');
      expect(commentRule).toBeDefined();
      expect(commentRule.fontStyle).toBe('italic');
      
      const keywordRule = monacoTheme.rules.find(r => r.token === 'keyword');
      expect(keywordRule).toBeDefined();
    });

    it('creates colors for editor', () => {
      const monacoTheme = createMonacoTheme(themes['github-dark']);
      expect(monacoTheme.colors).toBeDefined();
      expect(monacoTheme.colors['editor.background']).toBe(themes['github-dark'].editor.background);
      expect(monacoTheme.colors['editor.foreground']).toBe(themes['github-dark'].editor.foreground);
      expect(monacoTheme.colors['editorCursor.foreground']).toBe(themes['github-dark'].editor.cursor);
    });

    it('removes # from color values in rules', () => {
      const monacoTheme = createMonacoTheme(themes['monokai']);
      monacoTheme.rules.forEach(rule => {
        expect(rule.foreground).not.toContain('#');
      });
    });
  });

  describe('applyTheme', () => {
    beforeEach(() => {
      // Reset CSS variables
      document.documentElement.style.cssText = '';
    });

    it('applies background color', () => {
      applyTheme(themes['idec-dark']);
      expect(document.documentElement.style.getPropertyValue('--background')).toBe('#09090b');
    });

    it('applies foreground color', () => {
      applyTheme(themes['dracula']);
      expect(document.documentElement.style.getPropertyValue('--foreground')).toBe('#f8f8f2');
    });

    it('applies primary color', () => {
      applyTheme(themes['github-dark']);
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#58a6ff');
    });

    it('applies all color variables', () => {
      applyTheme(themes['nord']);
      const root = document.documentElement;
      
      expect(root.style.getPropertyValue('--background')).toBe(themes['nord'].colors.background);
      expect(root.style.getPropertyValue('--foreground')).toBe(themes['nord'].colors.foreground);
      expect(root.style.getPropertyValue('--card')).toBe(themes['nord'].colors.card);
      expect(root.style.getPropertyValue('--primary')).toBe(themes['nord'].colors.primary);
      expect(root.style.getPropertyValue('--secondary')).toBe(themes['nord'].colors.secondary);
      expect(root.style.getPropertyValue('--muted')).toBe(themes['nord'].colors.muted);
      expect(root.style.getPropertyValue('--accent')).toBe(themes['nord'].colors.accent);
      expect(root.style.getPropertyValue('--destructive')).toBe(themes['nord'].colors.destructive);
      expect(root.style.getPropertyValue('--border')).toBe(themes['nord'].colors.border);
    });

    it('applies light theme correctly', () => {
      applyTheme(themes['idec-light']);
      expect(document.documentElement.style.getPropertyValue('--background')).toBe('#ffffff');
    });
  });
});
