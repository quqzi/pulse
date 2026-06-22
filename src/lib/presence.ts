import { get, writable, type Unsubscriber } from 'svelte/store';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';
import { myGroups } from '$lib/groups';
import { auth } from '$lib/stores/auth';
import { getAuthContext } from '$lib/stores/data';
import { settings } from '$lib/stores/settings';
import { timerStore } from '$lib/stores/timer';

export type PresenceStatus = 'idle' | 'studying' | 'exam';

interface PresenceChannel {
  channel: RealtimeChannel;
  subscribed: boolean;
  userId: string;
}

const examActive = writable(false);
const channels = new Map<string, PresenceChannel>();
let unsubscribers: Unsubscriber[] = [];
let currentStatus: PresenceStatus = 'idle';
let initializing = false;

function deriveStatus(): PresenceStatus {
  if (get(examActive)) return 'exam';
  return get(timerStore).status === 'running' ? 'studying' : 'idle';
}

function currentIdentity(): { userId: string; name: string } | null {
  const context = getAuthContext();
  const authState = get(auth);
  if (context.mode !== 'authenticated' || authState.mode !== 'authenticated' || !authState.user) return null;
  return { userId: context.userId, name: authState.name };
}

function track(record: PresenceChannel): void {
  const identity = currentIdentity();
  if (!record.subscribed || !identity || !get(settings).shareActivity || record.userId !== identity.userId) return;
  void record.channel.track({ ...identity, status: currentStatus });
}

function broadcastStatus(): void {
  for (const record of channels.values()) track(record);
}

function removePresenceChannel(groupId: string): void {
  const record = channels.get(groupId);
  if (!record) return;
  channels.delete(groupId);
  void record.channel.untrack();
  void supabase.removeChannel(record.channel);
}

function teardownChannels(): void {
  for (const groupId of [...channels.keys()]) removePresenceChannel(groupId);
}

function reconcileChannels(): void {
  const identity = currentIdentity();
  if (!identity || !get(settings).shareActivity) {
    teardownChannels();
    return;
  }

  const approvedGroupIds = new Set(
    get(myGroups).filter(group => group.status === 'approved').map(group => group.id),
  );

  for (const [groupId, record] of channels) {
    if (!approvedGroupIds.has(groupId) || record.userId !== identity.userId) removePresenceChannel(groupId);
  }

  for (const groupId of approvedGroupIds) {
    if (channels.has(groupId)) continue;
    const channel = supabase.channel(`group-presence:${groupId}`, {
      config: { presence: { key: identity.userId } },
    });
    const record: PresenceChannel = { channel, subscribed: false, userId: identity.userId };
    channels.set(groupId, record);
    channel.subscribe(status => {
      if (status !== 'SUBSCRIBED' || channels.get(groupId) !== record) return;
      record.subscribed = true;
      track(record);
    });
  }
}

function refreshStatus(): void {
  const nextStatus = deriveStatus();
  if (nextStatus === currentStatus) return;
  currentStatus = nextStatus;
  broadcastStatus();
}

export function setExamActive(active: boolean): void {
  examActive.set(active);
}

export function startPresence(): void {
  if (unsubscribers.length > 0) {
    reconcileChannels();
    return;
  }

  currentStatus = deriveStatus();
  initializing = true;
  unsubscribers = [
    timerStore.subscribe(refreshStatus),
    examActive.subscribe(refreshStatus),
    settings.subscribe(() => {
      if (!initializing) reconcileChannels();
    }),
    myGroups.subscribe(() => {
      if (!initializing) reconcileChannels();
    }),
  ];
  initializing = false;
  reconcileChannels();
}

export function stopPresence(): void {
  for (const unsubscribe of unsubscribers) unsubscribe();
  unsubscribers = [];
  teardownChannels();
}
