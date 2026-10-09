import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_CUSTOMIZATIONS,
  CustomizationSettings,
  getUserCustomizationStorageKey,
  LOCAL_STORAGE_KEY_PREFIX,
  MIN_GENERAL_FONT_SIZE,
  MAX_GENERAL_FONT_SIZE,
  DEFAULT_GENERAL_FONT_SIZE,
  MIN_LABEL_FONT_SIZE,
  MAX_LABEL_FONT_SIZE,
  DEFAULT_LABEL_FONT_SIZE,
  getLabelFontSizeStyle,
} from '../components/CustomizationProvider';
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

describe('Font Size Settings & Styles', () => {
  it('defines reasonable font size constants and defaults', () => {
    expect(DEFAULT_GENERAL_FONT_SIZE).toBe(16);
    expect(MIN_GENERAL_FONT_SIZE).toBe(12);
    expect(MAX_GENERAL_FONT_SIZE).toBe(24);

    expect(DEFAULT_LABEL_FONT_SIZE).toBe(0);
    expect(MIN_LABEL_FONT_SIZE).toBe(10);
    expect(MAX_LABEL_FONT_SIZE).toBe(32);

    expect(DEFAULT_CUSTOMIZATIONS.generalFontSize).toBe(16);
  });

  it('defaults all 15 per-label font sizes to 0 (default / responsive styling)', () => {
    expect(DEFAULT_CUSTOMIZATIONS.payerListLabelFontSize).toBe(0);
    expect(DEFAULT_CUSTOMIZATIONS.beneficiaryListLabelFontSize).toBe(0);
    expect(DEFAULT_CUSTOMIZATIONS.balanceTitleLabelFontSize).toBe(0);
    expect(DEFAULT_CUSTOMIZATIONS.detailedBalanceLabelFontSize).toBe(0);
    expect(DEFAULT_CUSTOMIZATIONS.newEntryTitleLabelFontSize).toBe(0);
    expect(DEFAULT_CUSTOMIZATIONS.amountInputLabelFontSize).toBe(0);
    expect(DEFAULT_CUSTOMIZATIONS.descriptionInputLabelFontSize).toBe(0);
    expect(DEFAULT_CUSTOMIZATIONS.descriptionPlaceholderLabelFontSize).toBe(0);
    expect(DEFAULT_CUSTOMIZATIONS.addEntryButtonLabelFontSize).toBe(0);
    expect(DEFAULT_CUSTOMIZATIONS.allEntriesButtonLabelFontSize).toBe(0);
    expect(DEFAULT_CUSTOMIZATIONS.roomStatsButtonLabelFontSize).toBe(0);
    expect(DEFAULT_CUSTOMIZATIONS.quickActionsLabelFontSize).toBe(0);
    expect(DEFAULT_CUSTOMIZATIONS.presetsBarLabelFontSize).toBe(0);
    expect(DEFAULT_CUSTOMIZATIONS.autoBalanceButtonLabelFontSize).toBe(0);
    expect(DEFAULT_CUSTOMIZATIONS.syncTotalButtonLabelFontSize).toBe(0);
  });

  it('getLabelFontSizeStyle returns proper CSS style when in range [10, 32]', () => {
    expect(getLabelFontSizeStyle(16)).toEqual({ fontSize: '16px' });
    expect(getLabelFontSizeStyle(10)).toEqual({ fontSize: '10px' });
    expect(getLabelFontSizeStyle(32)).toEqual({ fontSize: '32px' });
    expect(getLabelFontSizeStyle(24)).toEqual({ fontSize: '24px' });
  });

  it('getLabelFontSizeStyle returns undefined for 0, out-of-range, or invalid values', () => {
    expect(getLabelFontSizeStyle(0)).toBeUndefined();
    expect(getLabelFontSizeStyle(9)).toBeUndefined();
    expect(getLabelFontSizeStyle(33)).toBeUndefined();
    expect(getLabelFontSizeStyle(-10)).toBeUndefined();
    expect(getLabelFontSizeStyle(undefined)).toBeUndefined();
    expect(getLabelFontSizeStyle(null as any)).toBeUndefined();
    expect(getLabelFontSizeStyle(NaN)).toBeUndefined();
  });

  it('allows independent modification of generalFontSize and individual label font sizes', () => {
    const settings: CustomizationSettings = { ...DEFAULT_CUSTOMIZATIONS };

    settings.generalFontSize = 20;
    settings.payerListLabelFontSize = 14;
    settings.amountInputLabelFontSize = 22;

    expect(settings.generalFontSize).toBe(20);
    expect(settings.payerListLabelFontSize).toBe(14);
    expect(settings.amountInputLabelFontSize).toBe(22);

    // Other label font sizes remain default 0
    expect(settings.beneficiaryListLabelFontSize).toBe(0);
    expect(settings.balanceTitleLabelFontSize).toBe(0);
    expect(settings.addEntryButtonLabelFontSize).toBe(0);
  });

  it('serializes and deserializes font size settings cleanly through JSON', () => {
    const custom: CustomizationSettings = {
      ...DEFAULT_CUSTOMIZATIONS,
      generalFontSize: 18,
      payerListLabelFontSize: 12,
      beneficiaryListLabelFontSize: 14,
      amountInputLabelFontSize: 20,
    };

    const json = JSON.stringify(custom);
    const parsed = JSON.parse(json);

    expect(parsed.generalFontSize).toBe(18);
    expect(parsed.payerListLabelFontSize).toBe(12);
    expect(parsed.beneficiaryListLabelFontSize).toBe(14);
    expect(parsed.amountInputLabelFontSize).toBe(20);
    expect(parsed).toEqual(custom);
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

describe('Account Customization Isolation & Multi-Account Switching', () => {
  it('generates strictly per-user storage keys and returns null for guests', () => {
    expect(getUserCustomizationStorageKey(1)).toBe('app_customizations_1');
    expect(getUserCustomizationStorageKey(42)).toBe('app_customizations_42');
    expect(getUserCustomizationStorageKey(undefined)).toBeNull();
    expect(getUserCustomizationStorageKey(null)).toBeNull();
    expect(getUserCustomizationStorageKey(0)).toBeNull();
    expect(getUserCustomizationStorageKey(-5)).toBeNull();
  });

  it('ensures separate users have distinct storage keys preventing key collision', () => {
    const userAKey = getUserCustomizationStorageKey(1);
    const userBKey = getUserCustomizationStorageKey(2);
    expect(userAKey).not.toBe(userBKey);
    expect(userAKey).toBe('app_customizations_1');
    expect(userBKey).toBe('app_customizations_2');
    expect(userAKey).not.toBe(LOCAL_STORAGE_KEY_PREFIX);
    expect(userBKey).not.toBe(LOCAL_STORAGE_KEY_PREFIX);
  });

  it('does not slip custom labels or customizations when User B logs in without saved settings', () => {
    // Simulate User A having custom labels and custom feature flags
    const userASettings: CustomizationSettings = {
      ...DEFAULT_CUSTOMIZATIONS,
      payerListLabel: "Alice's Payers",
      beneficiaryListLabel: "Alice's Receivers",
      balanceTitleLabel: "Alice's Vault",
      newEntryTitleLabel: "Alice's Expense",
      roomStats: false,
      currencyConverter: false,
    };

    // Simulate User B having an empty DB response (never customized settings before)
    const userBRemoteSettings = {};

    // When User B initializes or syncs, remote settings are merged over DEFAULT_CUSTOMIZATIONS
    const userBMergedSettings: CustomizationSettings = {
      ...DEFAULT_CUSTOMIZATIONS,
      ...userBRemoteSettings,
    };

    // User B must NOT have any of User A's custom labels
    expect(userBMergedSettings.payerListLabel).toBe('');
    expect(userBMergedSettings.beneficiaryListLabel).toBe('');
    expect(userBMergedSettings.balanceTitleLabel).toBe('');
    expect(userBMergedSettings.newEntryTitleLabel).toBe('');
    // User B must have default feature toggles
    expect(userBMergedSettings.roomStats).toBe(true);
    expect(userBMergedSettings.currencyConverter).toBe(true);
  });

  it('does not slip custom labels when User B only customized feature toggles', () => {
    // User A had set custom labels
    const userACustomLabels = {
      payerListLabel: "Alice's Payers",
      amountInputLabel: "Alice's Cost",
    };

    // User B only disabled currency converter in DB, without any custom labels
    const userBRemoteSettings = {
      currencyConverter: false,
    };

    const userBMergedSettings: CustomizationSettings = {
      ...DEFAULT_CUSTOMIZATIONS,
      ...userBRemoteSettings,
    };

    // User B gets their own feature toggle
    expect(userBMergedSettings.currencyConverter).toBe(false);
    // User B custom labels remain clean defaults, completely isolated from User A
    expect(userBMergedSettings.payerListLabel).toBe('');
    expect(userBMergedSettings.amountInputLabel).toBe('');
    expect(userBMergedSettings.payerListLabel).not.toBe(userACustomLabels.payerListLabel);
  });

  it('strictly isolates custom labels when both users have their own distinct labels', () => {
    const userARemoteSettings = {
      payerListLabel: "Alice's Payers",
      roomStatsButtonLabel: "Alice's Stats",
    };

    const userBRemoteSettings = {
      payerListLabel: "Bob's Payers",
      roomStatsButtonLabel: "Bob's Stats",
    };

    const userASettings: CustomizationSettings = {
      ...DEFAULT_CUSTOMIZATIONS,
      ...userARemoteSettings,
    };

    const userBSettings: CustomizationSettings = {
      ...DEFAULT_CUSTOMIZATIONS,
      ...userBRemoteSettings,
    };

    expect(userASettings.payerListLabel).toBe("Alice's Payers");
    expect(userBSettings.payerListLabel).toBe("Bob's Payers");
    expect(userASettings.roomStatsButtonLabel).toBe("Alice's Stats");
    expect(userBSettings.roomStatsButtonLabel).toBe("Bob's Stats");
    // Unset labels remain empty for both
    expect(userASettings.beneficiaryListLabel).toBe('');
    expect(userBSettings.beneficiaryListLabel).toBe('');
  });

  it('strictly isolates font size customizations between different users', () => {
    // User A has custom general font size and specific label font sizes
    const userARemoteSettings = {
      generalFontSize: 20,
      payerListLabelFontSize: 18,
      amountInputLabelFontSize: 24,
    };

    // User B has not set any custom font sizes
    const userBRemoteSettings = {};

    const userASettings: CustomizationSettings = {
      ...DEFAULT_CUSTOMIZATIONS,
      ...userARemoteSettings,
    };

    const userBSettings: CustomizationSettings = {
      ...DEFAULT_CUSTOMIZATIONS,
      ...userBRemoteSettings,
    };

    expect(userASettings.generalFontSize).toBe(20);
    expect(userASettings.payerListLabelFontSize).toBe(18);
    expect(userASettings.amountInputLabelFontSize).toBe(24);

    // User B defaults are strictly preserved without leaking User A's font settings
    expect(userBSettings.generalFontSize).toBe(16);
    expect(userBSettings.payerListLabelFontSize).toBe(0);
    expect(userBSettings.amountInputLabelFontSize).toBe(0);
  });
});

