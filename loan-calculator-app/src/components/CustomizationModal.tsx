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
  FiAlertTriangle,
  FiUsers,
  FiEdit3,
  FiTrash2,
  FiLayers,
} from 'react-icons/fi';
import { useCustomization, CustomizationSettings } from './CustomizationProvider';

interface CustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OPTIONAL_FEATURE_KEYS: Array<keyof Pick<
  CustomizationSettings,
  | 'customPresets'
  | 'premadePresets'
  | 'autoBalance'
  | 'syncTotal'
  | 'currencyConverter'
  | 'detailedBalance'
  | 'roomStats'
  | 'debtSettlementMap'
  | 'exportReports'
  | 'entryEditsHistory'
  | 'entryShareModal'
>> = [
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

type ModalTab = 'labels' | 'features' | 'developer';

export default function CustomizationModal({ isOpen, onClose }: CustomizationModalProps) {
  const t = useTranslations('Customization');
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('labels');

  const {
    customizations,
    updateCustomization,
    applyProfile,
    resetDefaults,
    resetLabels,
    resetDevFeatures,
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

  const isAllActive = OPTIONAL_FEATURE_KEYS.every((k) => customizations[k] === true);
  const isMinimalActive = OPTIONAL_FEATURE_KEYS.every((k) => customizations[k] === false);

  const hasAnyCustomLabel = Boolean(
    customizations.payerListLabel ||
    customizations.beneficiaryListLabel ||
    customizations.balanceTitleLabel ||
    customizations.detailedBalanceLabel ||
    customizations.newEntryTitleLabel ||
    customizations.amountInputLabel ||
    customizations.descriptionInputLabel ||
    customizations.descriptionPlaceholderLabel ||
    customizations.addEntryButtonLabel ||
    customizations.allEntriesButtonLabel ||
    customizations.roomStatsButtonLabel ||
    customizations.quickActionsLabel ||
    customizations.presetsBarLabel ||
    customizations.autoBalanceButtonLabel ||
    customizations.syncTotalButtonLabel
  );

  const hasAnyDevFeatureDisabled = Boolean(
    !customizations.coreSumBadge ||
    !customizations.coreEntryEditing ||
    !customizations.corePersonSelection ||
    !customizations.coreManualShareInputs ||
    !customizations.coreEnforceSumValidation ||
    !customizations.coreBalanceDisplay ||
    !customizations.coreEntryDeletion
  );

  const labelGroups: Array<{
    title: string;
    fields: Array<{
      key: keyof Pick<
        CustomizationSettings,
        | 'payerListLabel'
        | 'beneficiaryListLabel'
        | 'balanceTitleLabel'
        | 'detailedBalanceLabel'
        | 'newEntryTitleLabel'
        | 'amountInputLabel'
        | 'descriptionInputLabel'
        | 'descriptionPlaceholderLabel'
        | 'addEntryButtonLabel'
        | 'allEntriesButtonLabel'
        | 'roomStatsButtonLabel'
        | 'quickActionsLabel'
        | 'presetsBarLabel'
        | 'autoBalanceButtonLabel'
        | 'syncTotalButtonLabel'
      >;
      labelKey: string;
      placeholderKey: string;
    }>;
  }> = [
    {
      title: t('labelsGroupLists'),
      fields: [
        { key: 'payerListLabel', labelKey: 'fromLabelTitle', placeholderKey: 'fromLabelPlaceholder' },
        { key: 'beneficiaryListLabel', labelKey: 'toLabelTitle', placeholderKey: 'toLabelPlaceholder' },
      ],
    },
    {
      title: t('labelsGroupHeader'),
      fields: [
        { key: 'balanceTitleLabel', labelKey: 'balanceTitleLabelTitle', placeholderKey: 'balanceTitleLabelPlaceholder' },
        { key: 'detailedBalanceLabel', labelKey: 'detailedBalanceLabelTitle', placeholderKey: 'detailedBalanceLabelPlaceholder' },
      ],
    },
    {
      title: t('labelsGroupForm'),
      fields: [
        { key: 'newEntryTitleLabel', labelKey: 'newEntryTitleLabelTitle', placeholderKey: 'newEntryTitleLabelPlaceholder' },
        { key: 'amountInputLabel', labelKey: 'amountInputLabelTitle', placeholderKey: 'amountInputLabelPlaceholder' },
        { key: 'descriptionInputLabel', labelKey: 'descriptionInputLabelTitle', placeholderKey: 'descriptionInputLabelPlaceholder' },
        { key: 'descriptionPlaceholderLabel', labelKey: 'descriptionPlaceholderLabelTitle', placeholderKey: 'descriptionPlaceholderLabelPlaceholder' },
        { key: 'addEntryButtonLabel', labelKey: 'addEntryButtonLabelTitle', placeholderKey: 'addEntryButtonLabelPlaceholder' },
      ],
    },
    {
      title: t('labelsGroupPresets'),
      fields: [
        { key: 'quickActionsLabel', labelKey: 'quickActionsLabelTitle', placeholderKey: 'quickActionsLabelPlaceholder' },
        { key: 'presetsBarLabel', labelKey: 'presetsBarLabelTitle', placeholderKey: 'presetsBarLabelPlaceholder' },
        { key: 'autoBalanceButtonLabel', labelKey: 'autoBalanceButtonLabelTitle', placeholderKey: 'autoBalanceButtonLabelPlaceholder' },
        { key: 'syncTotalButtonLabel', labelKey: 'syncTotalButtonLabelTitle', placeholderKey: 'syncTotalButtonLabelPlaceholder' },
      ],
    },
    {
      title: t('labelsGroupNav'),
      fields: [
        { key: 'allEntriesButtonLabel', labelKey: 'allEntriesButtonLabelTitle', placeholderKey: 'allEntriesButtonLabelPlaceholder' },
        { key: 'roomStatsButtonLabel', labelKey: 'roomStatsButtonLabelTitle', placeholderKey: 'roomStatsButtonLabelPlaceholder' },
      ],
    },
  ];

  const optionalFeatureGroups: Array<{
    category: string;
    items: Array<{
      key: keyof Pick<
        CustomizationSettings,
        | 'customPresets'
        | 'premadePresets'
        | 'autoBalance'
        | 'syncTotal'
        | 'currencyConverter'
        | 'detailedBalance'
        | 'roomStats'
        | 'debtSettlementMap'
        | 'exportReports'
        | 'entryEditsHistory'
        | 'entryShareModal'
      >;
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

  const coreDeveloperFeatures: Array<{
    key: keyof Pick<
      CustomizationSettings,
      | 'coreSumBadge'
      | 'coreEntryEditing'
      | 'corePersonSelection'
      | 'coreManualShareInputs'
      | 'coreEnforceSumValidation'
      | 'coreBalanceDisplay'
      | 'coreEntryDeletion'
    >;
    icon: React.ReactNode;
    title: string;
    description: string;
    loss: string;
    breaking: string;
  }> = [
    {
      key: 'coreSumBadge',
      icon: <FiCheck className="text-emerald-500" />,
      title: t('coreSumBadgeTitle'),
      description: t('coreSumBadgeDesc'),
      loss: t('coreSumBadgeLoss'),
      breaking: t('coreSumBadgeBreak'),
    },
    {
      key: 'coreEntryEditing',
      icon: <FiEdit3 className="text-blue-500" />,
      title: t('coreEntryEditingTitle'),
      description: t('coreEntryEditingDesc'),
      loss: t('coreEntryEditingLoss'),
      breaking: t('coreEntryEditingBreak'),
    },
    {
      key: 'corePersonSelection',
      icon: <FiUsers className="text-purple-500" />,
      title: t('corePersonSelectionTitle'),
      description: t('corePersonSelectionDesc'),
      loss: t('corePersonSelectionLoss'),
      breaking: t('corePersonSelectionBreak'),
    },
    {
      key: 'coreManualShareInputs',
      icon: <FiDollarSign className="text-amber-500" />,
      title: t('coreManualShareInputsTitle'),
      description: t('coreManualShareInputsDesc'),
      loss: t('coreManualShareInputsLoss'),
      breaking: t('coreManualShareInputsBreak'),
    },
    {
      key: 'coreEnforceSumValidation',
      icon: <FiAlertTriangle className="text-red-500" />,
      title: t('coreEnforceSumValidationTitle'),
      description: t('coreEnforceSumValidationDesc'),
      loss: t('coreEnforceSumValidationLoss'),
      breaking: t('coreEnforceSumValidationBreak'),
    },
    {
      key: 'coreBalanceDisplay',
      icon: <FiLayers className="text-cyan-500" />,
      title: t('coreBalanceDisplayTitle'),
      description: t('coreBalanceDisplayDesc'),
      loss: t('coreBalanceDisplayLoss'),
      breaking: t('coreBalanceDisplayBreak'),
    },
    {
      key: 'coreEntryDeletion',
      icon: <FiTrash2 className="text-rose-500" />,
      title: t('coreEntryDeletionTitle'),
      description: t('coreEntryDeletionDesc'),
      loss: t('coreEntryDeletionLoss'),
      breaking: t('coreEntryDeletionBreak'),
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 pb-2 border-b border-card-border/60 dark:border-white/5 bg-muted/15 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('labels')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer inline-flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'labels'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <FiTag size={14} />
            <span>{t('labelsSectionTitle')}</span>
            {hasAnyCustomLabel && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('features')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer inline-flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'features'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <FiZap size={14} />
            <span>{t('featuresSectionTitle')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('developer')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer inline-flex items-center gap-2 whitespace-nowrap ms-auto ${
              activeTab === 'developer'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-amber-500/90 dark:text-amber-400 hover:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <FiAlertTriangle size={14} />
            <span>{t('devSectionTitle')}</span>
            {hasAnyDevFeatureDisabled && (
              <span className="px-1.5 py-0.2 text-[10px] bg-red-600 text-white font-bold rounded-full animate-pulse">
                !
              </span>
            )}
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 min-h-0">

          {/* TAB 1: ALL LABELS */}
          {activeTab === 'labels' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">
                    {t('labelsSectionTitle')}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('labelsSectionDesc')}
                  </p>
                </div>

                {hasAnyCustomLabel && (
                  <button
                    type="button"
                    onClick={resetLabels}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-card-border transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <FiRotateCcw size={13} />
                    <span>{t('resetAllLabels')}</span>
                  </button>
                )}
              </div>

              {labelGroups.map((group) => (
                <div
                  key={group.title}
                  className="p-4 sm:p-5 rounded-2xl bg-muted/40 border border-card-border/80 dark:border-white/5 space-y-3.5"
                >
                  <span className="text-xs font-bold text-primary uppercase tracking-wide block">
                    {group.title}
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {group.fields.map((field) => {
                      const val = customizations[field.key];
                      return (
                        <div key={field.key} className={field.key === 'descriptionPlaceholderLabel' ? 'sm:col-span-2' : ''}>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-semibold text-muted-foreground truncate">
                              {t(field.labelKey as any)}
                            </label>
                            {val && (
                              <button
                                type="button"
                                onClick={() => updateCustomization(field.key, '')}
                                className="text-[11px] text-muted-foreground hover:text-danger cursor-pointer ml-1"
                                title="Clear"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => updateCustomization(field.key, e.target.value)}
                            placeholder={t(field.placeholderKey as any)}
                            maxLength={50}
                            className="w-full themed-input px-3.5 py-2 text-sm rounded-xl border border-input bg-background font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: OPTIONAL FEATURES */}
          {activeTab === 'features' && (
            <div className="space-y-6 animate-fadeIn">
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

              {/* Feature Groups */}
              {optionalFeatureGroups.map((group) => (
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
          )}

          {/* TAB 3: DEVELOPER & TESTER ADVANCED */}
          {activeTab === 'developer' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Warning Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-foreground space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <FiAlertTriangle className="text-amber-500 text-lg shrink-0" />
                    <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      {t('devSectionBannerTitle')}
                    </h3>
                  </div>

                  {hasAnyDevFeatureDisabled && (
                    <button
                      type="button"
                      onClick={resetDevFeatures}
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <FiCheck size={13} />
                      <span>{t('devResetBtn')}</span>
                    </button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('devSectionBannerDesc')}
                </p>
              </div>

              {/* Core Feature Switches */}
              <div className="space-y-4">
                {coreDeveloperFeatures.map((item) => {
                  const isEnabled = customizations[item.key];
                  const isDangerState = !isEnabled;

                  return (
                    <div
                      key={item.key}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 space-y-3 ${
                        isDangerState
                          ? 'bg-red-500/5 dark:bg-red-500/10 border-red-500/40 shadow-sm'
                          : 'bg-card border-card-border/80 dark:border-white/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 sm:gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0 pr-1">
                          <span className={`mt-0.5 text-base sm:text-lg shrink-0 p-1.5 rounded-lg ${
                            isDangerState ? 'bg-red-500/20 text-red-400' : 'bg-muted/60 dark:bg-white/5'
                          }`}>
                            {item.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                                {item.title}
                              </span>
                              {isDangerState && (
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/30">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed mt-0.5">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        {/* Switch */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isEnabled}
                          onClick={() => updateCustomization(item.key, !isEnabled)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500/20 ${
                            isEnabled ? 'bg-primary' : 'bg-red-500'
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

                      {/* Explicit Warning Card for this core feature */}
                      <div className={`p-3 rounded-xl border text-xs space-y-1.5 transition-colors ${
                        isDangerState
                          ? 'bg-red-500/10 dark:bg-red-500/20 border-red-500/40 text-red-700 dark:text-red-300'
                          : 'bg-muted/40 border-card-border/60 text-muted-foreground'
                      }`}>
                        <div className="flex items-start gap-1.5">
                          <span className="font-bold shrink-0">⚠️ {t('devLossLabel')}</span>
                          <span className="leading-snug">{item.loss}</span>
                        </div>
                        <div className="flex items-start gap-1.5 pt-1 border-t border-card-border/40 dark:border-white/5">
                          <span className="font-bold shrink-0">💥 {t('devBreakLabel')}</span>
                          <span className="leading-snug">{item.breaking}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
