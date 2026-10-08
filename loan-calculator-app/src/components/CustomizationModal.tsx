// src/components/CustomizationModal.tsx
'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  FiSliders,
  FiX,
  FiCheck,
  FiRotateCcw,
  FiTag,
  FiDollarSign,
  FiPieChart,
  FiActivity,
  FiStar,
  FiZap,
  FiPercent,
  FiArrowUpCircle,
  FiDownload,
  FiClock,
  FiShare2,
} from 'react-icons/fi';
import { useCustomization, CustomizationSettings } from './CustomizationProvider';

interface CustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CustomizationModal({ isOpen, onClose }: CustomizationModalProps) {
  const t = useTranslations('Customization');
  const {
    customizations,
    updateCustomization,
    saveCustomizations,
    applyProfile,
    resetDefaults,
  } = useCustomization();

  if (!isOpen) return null;

  const toggleItems: Array<{
    category: string;
    items: Array<{
      key: keyof Omit<CustomizationSettings, 'payerListLabel' | 'beneficiaryListLabel'>;
      icon: React.ReactNode;
      title: string;
      description: string;
    }>;
  }> = [
    {
      category: t('categoryPresets'),
      items: [
        {
          key: 'customPresets',
          icon: <FiStar className="text-amber-500" />,
          title: t('customPresets'),
          description: t('customPresetsDesc'),
        },
        {
          key: 'premadePresets',
          icon: <FiZap className="text-blue-500" />,
          title: t('premadePresets'),
          description: t('premadePresetsDesc'),
        },
        {
          key: 'autoBalance',
          icon: <FiPercent className="text-emerald-500" />,
          title: t('autoBalance'),
          description: t('autoBalanceDesc'),
        },
        {
          key: 'syncTotal',
          icon: <FiArrowUpCircle className="text-purple-500" />,
          title: t('syncTotal'),
          description: t('syncTotalDesc'),
        },
      ],
    },
    {
      category: t('categoryCurrencies'),
      items: [
        {
          key: 'currencyConverter',
          icon: <FiDollarSign className="text-emerald-500" />,
          title: t('currencyConverter'),
          description: t('currencyConverterDesc'),
        },
      ],
    },
    {
      category: t('categoryAnalytics'),
      items: [
        {
          key: 'roomStats',
          icon: <FiPieChart className="text-indigo-500" />,
          title: t('roomStats'),
          description: t('roomStatsDesc'),
        },
        {
          key: 'detailedBalance',
          icon: <FiActivity className="text-sky-500" />,
          title: t('detailedBalance'),
          description: t('detailedBalanceDesc'),
        },
        {
          key: 'debtSettlementMap',
          icon: <FiZap className="text-violet-500" />,
          title: t('debtSettlementMap'),
          description: t('debtSettlementMapDesc'),
        },
        {
          key: 'exportReports',
          icon: <FiDownload className="text-teal-500" />,
          title: t('exportReports'),
          description: t('exportReportsDesc'),
        },
      ],
    },
    {
      category: t('categoryActions'),
      items: [
        {
          key: 'entryEditsHistory',
          icon: <FiClock className="text-orange-500" />,
          title: t('entryEditsHistory'),
          description: t('entryEditsHistoryDesc'),
        },
        {
          key: 'entryShareModal',
          icon: <FiShare2 className="text-pink-500" />,
          title: t('entryShareModal'),
          description: t('entryShareModalDesc'),
        },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg md:max-w-xl overflow-hidden bg-card/95 border border-card-border dark:border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-card-border/80 dark:border-white/5 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/15 text-primary">
              <FiSliders size={18} />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground leading-tight">
                {t('title')}
              </h2>
              <p className="text-[11px] sm:text-xs text-muted-foreground hidden sm:block">
                {t('subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6">

          {/* Quick Profiles Pills */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => applyProfile('all')}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <FiCheck size={13} />
              <span>{t('presetAll')}</span>
            </button>
            <button
              type="button"
              onClick={() => applyProfile('minimal')}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-card-border transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>{t('presetMinimal')}</span>
            </button>
            <button
              type="button"
              onClick={resetDefaults}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-card-border transition-all cursor-pointer inline-flex items-center gap-1.5 ml-auto"
            >
              <FiRotateCcw size={13} />
              <span>{t('resetDefault')}</span>
            </button>
          </div>

          {/* Section 1: Custom List Labels */}
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-muted/40 border border-card-border/80 dark:border-white/5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <FiTag className="text-primary text-sm" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {t('labelsSectionTitle')}
                </h3>
              </div>
              {(customizations.payerListLabel || customizations.beneficiaryListLabel) && (
                <button
                  type="button"
                  onClick={() => saveCustomizations({ payerListLabel: '', beneficiaryListLabel: '' })}
                  className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                >
                  {t('resetLabels')}
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t('labelsSectionDesc')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-1">
              {/* List 1 (Payer / From) */}
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  {t('fromLabelTitle')}
                </label>
                <input
                  type="text"
                  value={customizations.payerListLabel}
                  onChange={(e) => updateCustomization('payerListLabel', e.target.value)}
                  placeholder={t('fromLabelPlaceholder')}
                  maxLength={40}
                  className="w-full themed-input px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-input bg-background font-medium text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* List 2 (Beneficiary / To) */}
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  {t('toLabelTitle')}
                </label>
                <input
                  type="text"
                  value={customizations.beneficiaryListLabel}
                  onChange={(e) => updateCustomization('beneficiaryListLabel', e.target.value)}
                  placeholder={t('toLabelPlaceholder')}
                  maxLength={40}
                  className="w-full themed-input px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-input bg-background font-medium text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Feature Toggles */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
              {t('featuresSectionTitle')}
            </h3>

            {toggleItems.map((group) => (
              <div
                key={group.category}
                className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-card-border/80 dark:border-white/5 space-y-3"
              >
                <span className="text-[11px] font-bold text-primary uppercase tracking-wide">
                  {group.category}
                </span>

                <div className="divide-y divide-card-border/40 dark:divide-white/5 space-y-2.5 sm:space-y-3">
                  {group.items.map((item) => {
                    const isEnabled = customizations[item.key];
                    return (
                      <div
                        key={item.key}
                        className="pt-2.5 first:pt-0 flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5 flex-1 min-w-0 pr-2">
                          <span className="mt-0.5 text-base shrink-0">
                            {item.icon}
                          </span>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-foreground block truncate">
                              {item.title}
                            </span>
                            <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        {/* iOS-style Switch Toggle */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isEnabled}
                          onClick={() => updateCustomization(item.key, !isEnabled)}
                          className={`relative inline-flex h-5 w-10 sm:h-6 sm:w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                            isEnabled ? 'bg-primary' : 'bg-muted-foreground/30 dark:bg-zinc-700'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                              isEnabled
                                ? 'translate-x-5 sm:translate-x-5 rtl:-translate-x-5 rtl:sm:-translate-x-5'
                                : 'translate-x-0 rtl:translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-card-border/80 dark:border-white/5 bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl btn-primary font-bold text-xs sm:text-sm cursor-pointer shadow-md"
          >
            {t('done')}
          </button>
        </div>

      </div>
    </div>
  );
}
