// src/components/CustomizationModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

const ALL_FEATURE_KEYS: Array<keyof Omit<CustomizationSettings, 'payerListLabel' | 'beneficiaryListLabel'>> = [
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
];

export default function CustomizationModal({ isOpen, onClose }: CustomizationModalProps) {
  const t = useTranslations('Customization');
  const [mounted, setMounted] = useState(false);
  const {
    customizations,
    updateCustomization,
    saveCustomizations,
    applyProfile,
    resetDefaults,
  } = useCustomization();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const isAllActive = ALL_FEATURE_KEYS.every((k) => customizations[k] === true);
  const isMinimalActive = ALL_FEATURE_KEYS.every((k) => customizations[k] === false);

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

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="customization-modal-title"
    >
      <div
        className="w-full max-w-2xl bg-card border border-card-border dark:border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-card-border/80 dark:border-white/5 bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 sm:p-2.5 rounded-xl bg-primary/15 text-primary shrink-0">
              <FiSliders size={20} />
            </span>
            <div>
              <h2 id="customization-modal-title" className="text-base sm:text-lg font-bold text-foreground leading-tight">
                {t('title')}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {t('subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 min-h-0">

          {/* Quick Profiles Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => applyProfile('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                isAllActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted hover:bg-muted/80 text-foreground border border-card-border'
              }`}
            >
              {isAllActive && <FiCheck size={14} className="shrink-0" />}
              <span>{t('presetAll')}</span>
            </button>
            <button
              type="button"
              onClick={() => applyProfile('minimal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                isMinimalActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted hover:bg-muted/80 text-foreground border border-card-border'
              }`}
            >
              {isMinimalActive && <FiCheck size={14} className="shrink-0" />}
              <span>{t('presetMinimal')}</span>
            </button>
            <button
              type="button"
              onClick={resetDefaults}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-card-border transition-all cursor-pointer inline-flex items-center gap-1.5 ms-auto"
            >
              <FiRotateCcw size={13} className="shrink-0" />
              <span>{t('resetDefault')}</span>
            </button>
          </div>

          {/* Section 1: Custom List Labels */}
          <div className="p-4 sm:p-5 rounded-2xl bg-muted/40 border border-card-border/80 dark:border-white/5 space-y-3.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <FiTag className="text-primary text-sm shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">
                  {t('labelsSectionTitle')}
                </h3>
              </div>
              {(customizations.payerListLabel || customizations.beneficiaryListLabel) && (
                <button
                  type="button"
                  onClick={() => saveCustomizations({ payerListLabel: '', beneficiaryListLabel: '' })}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                >
                  {t('resetLabels')}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('labelsSectionDesc')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
              {/* List 1 (Payer / From) */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('fromLabelTitle')}
                </label>
                <input
                  type="text"
                  value={customizations.payerListLabel}
                  onChange={(e) => updateCustomization('payerListLabel', e.target.value)}
                  placeholder={t('fromLabelPlaceholder')}
                  maxLength={40}
                  className="w-full themed-input px-3.5 py-2 text-sm rounded-xl border border-input bg-background font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              {/* List 2 (Beneficiary / To) */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('toLabelTitle')}
                </label>
                <input
                  type="text"
                  value={customizations.beneficiaryListLabel}
                  onChange={(e) => updateCustomization('beneficiaryListLabel', e.target.value)}
                  placeholder={t('toLabelPlaceholder')}
                  maxLength={40}
                  className="w-full themed-input px-3.5 py-2 text-sm rounded-xl border border-input bg-background font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Feature Toggles */}
          <div className="space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">
              {t('featuresSectionTitle')}
            </h3>

            {toggleItems.map((group) => (
              <div
                key={group.category}
                className="p-4 sm:p-5 rounded-2xl bg-card border border-card-border/80 dark:border-white/5 space-y-3"
              >
                <span className="text-xs font-bold text-primary uppercase tracking-wide block">
                  {group.category}
                </span>

                <div className="divide-y divide-card-border/40 dark:divide-white/5">
                  {group.items.map((item) => {
                    const isEnabled = customizations[item.key];
                    return (
                      <div
                        key={item.key}
                        className="py-3 first:pt-1 last:pb-0 flex items-start justify-between gap-3 sm:gap-4"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0 pr-1">
                          <span className="mt-0.5 text-base sm:text-lg shrink-0 p-1.5 rounded-lg bg-muted/60 dark:bg-white/5">
                            {item.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs sm:text-sm font-semibold text-foreground block leading-snug">
                              {item.title}
                            </span>
                            <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed mt-0.5">
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
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                            isEnabled ? 'bg-primary' : 'bg-muted-foreground/30 dark:bg-zinc-700'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                              isEnabled
                                ? 'translate-x-5 rtl:-translate-x-5'
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
        <div className="p-4 sm:p-5 border-t border-card-border/80 dark:border-white/5 bg-muted/20 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 sm:py-3 px-4 rounded-xl btn-primary font-bold text-sm sm:text-base cursor-pointer shadow-md transition-transform active:scale-[0.99]"
          >
            {t('done')}
          </button>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
