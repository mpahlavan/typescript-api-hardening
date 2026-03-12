import {
  isTemplateCacheValid,
  getTemplatesCache,
  setTemplatesCache,
  invalidateTemplatesCache,
} from '../src/cache';
import { TemplateRow } from '../src/types';

const mockRow: TemplateRow = {
  id: 'tpl_test',
  title: 'Test Template',
  source: { type: 'canvas' },
  order_index: 1,
  created_at: new Date(),
  updated_at: new Date(),
  categories: ['minimal'],
};

describe('cache', () => {
  beforeEach(() => {
    invalidateTemplatesCache();
  });

  it('is invalid when empty', () => {
    expect(isTemplateCacheValid()).toBe(false);
    expect(getTemplatesCache()).toBeNull();
  });

  it('is valid after setTemplatesCache()', () => {
    setTemplatesCache([mockRow]);
    expect(isTemplateCacheValid()).toBe(true);
    expect(getTemplatesCache()).toEqual([mockRow]);
  });

  it('is invalid after invalidateTemplatesCache()', () => {
    setTemplatesCache([mockRow]);
    invalidateTemplatesCache();
    expect(isTemplateCacheValid()).toBe(false);
    expect(getTemplatesCache()).toBeNull();
  });

  it('is invalid when TTL has expired', () => {
    setTemplatesCache([mockRow]);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
    expect(isTemplateCacheValid()).toBe(false);
    jest.restoreAllMocks();
  });
});
