# Project Directory Map

Cached directory structure for `my-loan-app`.

```text
my-loan-app/
├── .github/
│   └── workflows/
│       ├── deploy-dev.yml
│       └── deploy-loan-app-docker.yml
├── .gitattributes
├── .gitignore
├── README.md
└── loan-calculator-app/
    ├── messages/
    │   ├── en.json
    │   ├── he.json
    │   └── ru.json
    ├── migrations/
    │   ├── 001_multi_party_rbac.sql
    │   ├── 002_explicit_splits.sql
    │   ├── 003_backfill_explicit_splits.sql
    │   ├── 003_permissions.sql
    │   ├── 004_round_jsonb_percentages.sql
    │   ├── 005_revert_004_round_jsonb_percentages.sql
    │   ├── 006_split_presets.sql
    │   └── 007_user_customizations.sql
    ├── public/
    │   ├── icons/
    │   ├── manifest.json
    │   └── push-sw.js
    ├── scripts/
    │   ├── fix-rounding.js
    │   ├── generate-icons.js
    │   ├── make_ico.py
    │   └── migrate.js
    ├── src/
    │   ├── __tests__/
    │   │   ├── currency-converter.test.ts
    │   │   ├── customization.test.ts
    │   │   ├── offline-sync.test.ts
    │   │   ├── participant-filtering.test.ts
    │   │   ├── payer-beneficiary-split.test.ts
    │   │   ├── peer-to-peer-balance.test.ts
    │   │   ├── split-presets.test.ts
    │   │   └── stats-calc.test.ts
    │   ├── app/
    │   │   ├── api/
    │   │   │   ├── auth/
    │   │   │   ├── currency/route.ts
    │   │   │   ├── entries/
    │   │   │   ├── notifications/subscribe/route.ts
    │   │   │   ├── rooms/
    │   │   │   ├── split-presets/route.ts
    │   │   │   └── user/
    │   │   ├── rooms/
    │   │   │   ├── [roomId]/
    │   │   │   │   ├── balance/page.tsx
    │   │   │   │   ├── coverage/page.tsx
    │   │   │   │   ├── entries/page.tsx
    │   │   │   │   ├── stats/page.tsx
    │   │   │   │   └── page.tsx
    │   │   │   ├── layout.tsx
    │   │   │   └── page.tsx
    │   │   ├── ~offline/page.tsx
    │   │   ├── globals.css
    │   │   ├── layout.tsx
    │   │   └── page.tsx
    │   ├── components/
    │   │   ├── AdminPanel.tsx
    │   │   ├── BilateralCheckCoverage.tsx
    │   │   ├── ConfirmationDialog.tsx
    │   │   ├── CurrencyAmountInput.tsx
    │   │   ├── CustomizationModal.tsx
    │   │   ├── CustomizationProvider.tsx
    │   │   ├── DebtSettlementMap.tsx
    │   │   ├── EditEntryModal.tsx
    │   │   ├── EntryEditsModal.tsx
    │   │   ├── InfoTooltip.tsx
    │   │   ├── IntlProvider.tsx
    │   │   ├── LanguageSwitcher.tsx
    │   │   ├── PayerBeneficiarySelector.tsx
    │   │   ├── PermissionContext.tsx
    │   │   ├── PushSubscriptionToggle.tsx
    │   │   ├── RoomsSidebar.tsx
    │   │   ├── ShareEntryModal.tsx
    │   │   ├── SimplifiedLayoutProvider.tsx
    │   │   ├── SyncProvider.tsx
    │   │   ├── ThemeProvider.tsx
    │   │   ├── ThemeSwitcher.tsx
    │   │   └── UserProvider.tsx
    │   ├── lib/
    │   │   ├── hooks/
    │   │   │   └── useSplitPresets.ts
    │   │   ├── api.ts
    │   │   ├── auth.ts
    │   │   ├── balance-calc.ts
    │   │   ├── constants.ts
    │   │   ├── currency.ts
    │   │   ├── db.ts
    │   │   ├── entry-formatting.tsx
    │   │   ├── notification-messages.ts
    │   │   ├── notifications.ts
    │   │   ├── offline-sync.ts
    │   │   ├── push-client.ts
    │   │   ├── room-resolver.ts
    │   │   ├── split-calc.ts
    │   │   └── stats-calc.ts
    │   └── types/
    │       └── html2pdf.d.ts
    ├── package.json
    ├── tailwind.config.ts
    └── tsconfig.json
```
