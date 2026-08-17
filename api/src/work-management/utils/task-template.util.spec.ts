import { parseTemplateItems } from './task-template.util';

describe('parseTemplateItems', () => {
  it('accepts valid items with checklist and subtasks', () => {
    const items = parseTemplateItems([
      {
        title: 'Kickoff',
        priority: 'HIGH',
        checklist: [{ text: 'Invite' }],
        subtasks: [{ title: 'Agenda' }],
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Kickoff');
  });

  it('rejects empty array', () => {
    expect(() => parseTemplateItems([])).toThrow();
  });

  it('rejects missing title', () => {
    expect(() => parseTemplateItems([{ priority: 'LOW' }])).toThrow();
  });
});
