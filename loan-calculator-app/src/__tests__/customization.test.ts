import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_CUSTOMIZATIONS, CustomizationSettings } from '../components/CustomizationProvider';
import { GET, PUT } from '../app/api/user/customizations/route';
import * as auth from '../lib/auth';
import { db } from '../lib/db';

export function resolveListLabel(customLabel: string | undefined, defaultLabel: string): string {
  return customLabel && customLabel.trim().length > 0 ? customLabel.trim() : defaultLabel;
}

describe('Customization Settings & Label Logic', () => {
  it('has all feature toggles enabled by default', () => {
    expect(DEFAULT_CUSTOMIZATIONS.customPresets).toBe(true);
    expect(DEFAULT_CUSTOMIZATIONS.premadePresets).toBe(true);
    expect(DEFAULT_CUSTOMIZATIONS.autoBalance).toBe(true);
    expect(DEFAULT_CUSTOMIZATIONS.syncTotal).toBe(true);
    expect(DEFAULT_CUSTOMIZATIONS.currencyConverter).toBe(true);
    expect(DEFAULT_CUSTOMIZATIONS.detailedBalance).toBe(true);
    expect(DEFAULT_CUSTOMIZATIONS.roomStats).toBe(true);
    expect(DEFAULT_CUSTOMIZATIONS.debtSettlementMap).toBe(true);
    expect(DEFAULT_CUSTOMIZATIONS.exportReports).toBe(true);
    expect(DEFAULT_CUSTOMIZATIONS.entryEditsHistory).toBe(true);
    expect(DEFAULT_CUSTOMIZATIONS.entryShareModal).toBe(true);
  });

  it('has all developer core feature toggles enabled by default', () => {
    expect(DEFAULT_CUSTOMIZATIONS.coreSumBadge).toBe(true);
    expect(DEFAULT_CUSTOMIZATIONS.coreEntryEditing).toBe(true);
    expect(DEFAULT_CUSTOMIZATIONS.corePersonSelection).toBe(true);
    expect(DEFAULT_CUSTOMIZATIONS.coreManualShareInputs).toBe(true);
    expect(DEFAULT_CUSTOMIZATIONS.coreEnforceSumValidation).toBe(true);
    expect(DEFAULT_CUSTOMIZATIONS.coreBalanceDisplay).toBe(true);
    expect(DEFAULT_CUSTOMIZATIONS.coreEntryDeletion).toBe(true);
  });

  it('keeps customPresets and premadePresets strictly separate', () => {
    const settings: CustomizationSettings = { ...DEFAULT_CUSTOMIZATIONS };
    
    // Toggle customPresets OFF, premadePresets stays ON
    settings.customPresets = false;
    expect(settings.customPresets).toBe(false);
    expect(settings.premadePresets).toBe(true);

    // Toggle premadePresets OFF, customPresets stays as-is
    settings.premadePresets = false;
    expect(settings.customPresets).toBe(false);
    expect(settings.premadePresets).toBe(false);

    // Re-enable customPresets independently
    settings.customPresets = true;
    expect(settings.customPresets).toBe(true);
    expect(settings.premadePresets).toBe(false);
  });

  it('allows disabling developer core features independently', () => {
    const settings: CustomizationSettings = { ...DEFAULT_CUSTOMIZATIONS };
    settings.coreSumBadge = false;
    settings.corePersonSelection = false;

    expect(settings.coreSumBadge).toBe(false);
    expect(settings.corePersonSelection).toBe(false);
    expect(settings.coreEntryEditing).toBe(true);
    expect(settings.coreManualShareInputs).toBe(true);
    expect(settings.coreEnforceSumValidation).toBe(true);
    expect(settings.coreBalanceDisplay).toBe(true);
    expect(settings.coreEntryDeletion).toBe(true);
  });

  it('defaults all custom labels to empty string and resolves to localized defaults', () => {
    expect(DEFAULT_CUSTOMIZATIONS.payerListLabel).toBe('');
    expect(DEFAULT_CUSTOMIZATIONS.beneficiaryListLabel).toBe('');
    expect(DEFAULT_CUSTOMIZATIONS.balanceTitleLabel).toBe('');
    expect(DEFAULT_CUSTOMIZATIONS.detailedBalanceLabel).toBe('');
    expect(DEFAULT_CUSTOMIZATIONS.newEntryTitleLabel).toBe('');
    expect(DEFAULT_CUSTOMIZATIONS.amountInputLabel).toBe('');
    expect(DEFAULT_CUSTOMIZATIONS.descriptionInputLabel).toBe('');
    expect(DEFAULT_CUSTOMIZATIONS.descriptionPlaceholderLabel).toBe('');
    expect(DEFAULT_CUSTOMIZATIONS.addEntryButtonLabel).toBe('');
    expect(DEFAULT_CUSTOMIZATIONS.allEntriesButtonLabel).toBe('');
    expect(DEFAULT_CUSTOMIZATIONS.roomStatsButtonLabel).toBe('');
    expect(DEFAULT_CUSTOMIZATIONS.quickActionsLabel).toBe('');
    expect(DEFAULT_CUSTOMIZATIONS.presetsBarLabel).toBe('');
    expect(DEFAULT_CUSTOMIZATIONS.autoBalanceButtonLabel).toBe('');
    expect(DEFAULT_CUSTOMIZATIONS.syncTotalButtonLabel).toBe('');

    // English defaults
    expect(resolveListLabel(DEFAULT_CUSTOMIZATIONS.payerListLabel, 'From')).toBe('From');
    expect(resolveListLabel(DEFAULT_CUSTOMIZATIONS.beneficiaryListLabel, 'To')).toBe('To');
    expect(resolveListLabel(DEFAULT_CUSTOMIZATIONS.balanceTitleLabel, 'Balance')).toBe('Balance');
    expect(resolveListLabel(DEFAULT_CUSTOMIZATIONS.amountInputLabel, 'Amount')).toBe('Amount');
    expect(resolveListLabel(DEFAULT_CUSTOMIZATIONS.addEntryButtonLabel, 'Add entry')).toBe('Add entry');

    // Russian defaults
    expect(resolveListLabel(DEFAULT_CUSTOMIZATIONS.payerListLabel, 'От кого')).toBe('От кого');
    expect(resolveListLabel(DEFAULT_CUSTOMIZATIONS.beneficiaryListLabel, 'Кому')).toBe('Кому');
    expect(resolveListLabel(DEFAULT_CUSTOMIZATIONS.balanceTitleLabel, 'Баланс')).toBe('Баланс');
    expect(resolveListLabel(DEFAULT_CUSTOMIZATIONS.newEntryTitleLabel, 'Новая запись')).toBe('Новая запись');
    expect(resolveListLabel(DEFAULT_CUSTOMIZATIONS.addEntryButtonLabel, 'Добавить запись')).toBe('Добавить запись');
    expect(resolveListLabel(DEFAULT_CUSTOMIZATIONS.allEntriesButtonLabel, 'Все записи')).toBe('Все записи');
    expect(resolveListLabel(DEFAULT_CUSTOMIZATIONS.roomStatsButtonLabel, 'Статистика комнаты')).toBe('Статистика комнаты');
  });

  it('uses raw custom user text without modification for any label', () => {
    expect(resolveListLabel('Who paid the bill?', 'From')).toBe('Who paid the bill?');
    expect(resolveListLabel('Плательщик', 'От кого')).toBe('Плательщик');
    expect(resolveListLabel('Мой общий счёт', 'Баланс')).toBe('Мой общий счёт');
    expect(resolveListLabel('Сумма чека', 'Сумма')).toBe('Сумма чека');
    expect(resolveListLabel('Сохранить трату', 'Добавить запись')).toBe('Сохранить трату');
    expect(resolveListLabel('Журнал', 'Все записи')).toBe('Журнал');
  });

  it('correctly computes isAllActive and isMinimalActive profile states', () => {
    const ALL_FEATURE_KEYS = [
      'customPresets',
      'premadePresets',
      'autoBalance',
      'syncTotal',
      'currencyConverter',
      'detailedBalance',
      'roomStats',
      'debtSettlementMap',
      'exportReports',
      'entryEditsHistory',
      'entryShareModal',
    ] as const;

    // Default state: all active
    const defaultState = { ...DEFAULT_CUSTOMIZATIONS };
    expect(ALL_FEATURE_KEYS.every(k => defaultState[k] === true)).toBe(true);
    expect(ALL_FEATURE_KEYS.every(k => defaultState[k] === false)).toBe(false);

    // Minimal state: minimal active, all inactive
    const minimalState: CustomizationSettings = {
      ...DEFAULT_CUSTOMIZATIONS,
      customPresets: false,
      premadePresets: false,
      autoBalance: false,
      syncTotal: false,
      currencyConverter: false,
      detailedBalance: false,
      roomStats: false,
      debtSettlementMap: false,
      exportReports: false,
      entryEditsHistory: false,
      entryShareModal: false,
    };
    expect(ALL_FEATURE_KEYS.every(k => minimalState[k] === true)).toBe(false);
    expect(ALL_FEATURE_KEYS.every(k => minimalState[k] === false)).toBe(true);

    // Mixed/custom state: neither is active
    const mixedState = { ...minimalState, customPresets: true };
    expect(ALL_FEATURE_KEYS.every(k => mixedState[k] === true)).toBe(false);
    expect(ALL_FEATURE_KEYS.every(k => mixedState[k] === false)).toBe(false);
  });

  it('applies minimal profile by turning all non-core features off while preserving core developer features', () => {
    const minimal: CustomizationSettings = {
      ...DEFAULT_CUSTOMIZATIONS,
      customPresets: false,
      premadePresets: false,
      autoBalance: false,
      syncTotal: false,
      currencyConverter: false,
      detailedBalance: false,
      roomStats: false,
      debtSettlementMap: false,
      exportReports: false,
      entryEditsHistory: false,
      entryShareModal: false,
    };

    expect(minimal.customPresets).toBe(false);
    expect(minimal.premadePresets).toBe(false);
    expect(minimal.currencyConverter).toBe(false);
    expect(minimal.roomStats).toBe(false);
    expect(minimal.payerListLabel).toBe('');

    // Core developer features are preserved
    expect(minimal.coreSumBadge).toBe(true);
    expect(minimal.coreEntryEditing).toBe(true);
    expect(minimal.corePersonSelection).toBe(true);
    expect(minimal.coreEnforceSumValidation).toBe(true);
  });

  it('serializes and deserializes cleanly through JSON', () => {
    const sample: CustomizationSettings = {
      ...DEFAULT_CUSTOMIZATIONS,
      customPresets: false,
      payerListLabel: 'Sender',
      beneficiaryListLabel: 'Receivers',
      balanceTitleLabel: 'Vault Balance',
      amountInputLabel: 'Cost',
      coreSumBadge: false,
      corePersonSelection: false,
    };

    const json = JSON.stringify(sample);
    const parsed = JSON.parse(json);

    expect(parsed).toEqual(sample);
  });
});

describe('User Customizations API Route (/api/user/customizations)', () => {
  it('returns 401 Unauthorized for GET without valid token', async () => {
    vi.spyOn(auth, 'verifyToken').mockReturnValueOnce(null);

    const req = new Request('http://localhost/api/user/customizations', {
      method: 'GET',
      headers: { authorization: 'Bearer invalid' },
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 Unauthorized for PUT without valid token', async () => {
    vi.spyOn(auth, 'verifyToken').mockReturnValueOnce(null);

    const req = new Request('http://localhost/api/user/customizations', {
      method: 'PUT',
      headers: { authorization: 'Bearer invalid' },
      body: JSON.stringify({ customPresets: false }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it('returns saved customizations for authenticated user on GET', async () => {
    vi.spyOn(auth, 'verifyToken').mockReturnValueOnce({ userId: 42, username: 'marina' });
    vi.spyOn(db, 'query').mockResolvedValueOnce({
      rows: [{ settings: { customPresets: false, payerListLabel: 'From Me' } }],
    } as any);

    const req = new Request('http://localhost/api/user/customizations', {
      method: 'GET',
      headers: { authorization: 'Bearer valid_token' },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.customPresets).toBe(false);
    expect(data.payerListLabel).toBe('From Me');
  });

  it('upserts customizations for authenticated user on PUT', async () => {
    vi.spyOn(auth, 'verifyToken').mockReturnValueOnce({ userId: 42, username: 'marina' });
    vi.spyOn(db, 'query').mockResolvedValueOnce({
      rows: [{ settings: { premadePresets: false, beneficiaryListLabel: 'To All' } }],
    } as any);

    const req = new Request('http://localhost/api/user/customizations', {
      method: 'PUT',
      headers: { authorization: 'Bearer valid_token' },
      body: JSON.stringify({ premadePresets: false, beneficiaryListLabel: 'To All' }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.premadePresets).toBe(false);
    expect(data.beneficiaryListLabel).toBe('To All');
  });
});
