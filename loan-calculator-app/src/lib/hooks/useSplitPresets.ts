'use client';

import { useState, useEffect, useCallback } from 'react';
import { handleApi } from '@/lib/api';

export interface SplitPresetShare {
  userId: number;
  percentage: number;
}

export interface SplitPreset {
  id: number;
  name: string;
  room_id?: number | null;
  shares: SplitPresetShare[];
  created_at?: string;
}

export function useSplitPresets(roomId?: string | number | null) {
  const [presets, setPresets] = useState<SplitPreset[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPresets = useCallback(async () => {
    if (!roomId) return;
    setIsLoading(true);
    try {
      const data = await handleApi({
        method: 'GET',
        url: `/api/split-presets?roomId=${encodeURIComponent(String(roomId))}`,
      });
      if (Array.isArray(data)) {
        setPresets(data);
      }
    } catch (err) {
      console.error('Failed to fetch split presets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const savePreset = useCallback(
    async (name: string, shares: SplitPresetShare[]) => {
      if (!name.trim() || shares.length === 0) return;
      try {
        const result = await handleApi({
          method: 'POST',
          url: '/api/split-presets',
          body: {
            roomId,
            name: name.trim(),
            shares,
          },
        });
        if (result && result.id) {
          setPresets((prev) => [...prev.filter((p) => p.id !== result.id), result]);
        } else {
          await fetchPresets();
        }
        return result;
      } catch (err) {
        console.error('Failed to save split preset:', err);
        throw err;
      }
    },
    [roomId, fetchPresets]
  );

  const deletePreset = useCallback(
    async (presetId: number) => {
      try {
        setPresets((prev) => prev.filter((p) => p.id !== presetId));
        await handleApi({
          method: 'DELETE',
          url: `/api/split-presets?id=${presetId}`,
        });
      } catch (err) {
        console.error('Failed to delete split preset:', err);
        await fetchPresets();
        throw err;
      }
    },
    [fetchPresets]
  );

  return {
    presets,
    isLoading,
    savePreset,
    deletePreset,
    refetch: fetchPresets,
  };
}
