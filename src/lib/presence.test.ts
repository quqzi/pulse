import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get, writable, type Writable } from 'svelte/store';
import type { AuthState } from '$lib/stores/auth';
import type { GroupSummary } from '$lib/groups';

interface TestChannel {
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  track: ReturnType<typeof vi.fn>;
  untrack: ReturnType<typeof vi.fn>;
  presenceState: ReturnType<typeof vi.fn>;
  emitSubscribed(): void;
  emitPresenceSync(): void;
  setPresenceState(state: Record<string, Record<string, unknown>[]>): void;
}

interface Harness {
  auth: Writable<AuthState>;
  settings: Writable<{ shareActivity: boolean }>;
  timer: Writable<{ status: 'idle' | 'running' | 'paused'; elapsed?: number }>;
  groups: Writable<GroupSummary[]>;
  channels: TestChannel[];
  channel: ReturnType<typeof vi.fn>;
  removeChannel: ReturnType<typeof vi.fn>;
}

const approvedGroup = (id: string): GroupSummary => ({
  id,
  name: `Group ${id}`,
  inviteCode: null,
  role: 'member',
  status: 'approved',
  visible: true,
  memberCount: 2,
  pendingCount: 0,
  isOwner: false,
});

async function setup(options?: { authenticated?: boolean; shareActivity?: boolean; groups?: GroupSummary[] }) {
  const authenticated = options?.authenticated ?? true;
  const auth = writable<AuthState>(authenticated
    ? { mode: 'authenticated', user: { id: 'user-1' } as AuthState['user'], name: 'Mali' }
    : { mode: 'guest', user: null, name: 'Guest' });
  const settings = writable({ shareActivity: options?.shareActivity ?? true });
  const timer = writable<{ status: 'idle' | 'running' | 'paused'; elapsed?: number }>({ status: 'idle' });
  const groups = writable(options?.groups ?? [approvedGroup('group-1')]);
  const channels: TestChannel[] = [];
  const channel = vi.fn(() => {
    let subscriptionCallback: ((status: string) => void) | undefined;
    let presenceSyncCallback: (() => void) | undefined;
    let presenceState: Record<string, Record<string, unknown>[]> = {};
    const instance: TestChannel = {
      on: vi.fn((type: string, filter: { event: string }, callback: () => void) => {
        if (type === 'presence' && filter.event === 'sync') presenceSyncCallback = callback;
        return instance;
      }),
      subscribe: vi.fn((callback: (status: string) => void) => {
        subscriptionCallback = callback;
        return instance;
      }),
      track: vi.fn().mockResolvedValue('ok'),
      untrack: vi.fn().mockResolvedValue('ok'),
      presenceState: vi.fn(() => presenceState),
      emitSubscribed: () => subscriptionCallback?.('SUBSCRIBED'),
      emitPresenceSync: () => presenceSyncCallback?.(),
      setPresenceState: state => {
        presenceState = state;
      },
    };
    channels.push(instance);
    return instance;
  });
  const removeChannel = vi.fn().mockResolvedValue('ok');

  vi.doMock('$lib/stores/auth', () => ({ auth }));
  vi.doMock('$lib/stores/settings', () => ({ settings }));
  vi.doMock('$lib/stores/timer', () => ({ timerStore: timer }));
  vi.doMock('$lib/groups', () => ({ myGroups: groups }));
  vi.doMock('$lib/stores/data', () => ({
    getAuthContext: () => {
      const state = get(auth);
      return state.mode === 'authenticated'
        ? { userId: state.user?.id ?? '', mode: 'authenticated' as const }
        : { userId: 'guest', mode: 'guest' as const };
    },
  }));
  vi.doMock('$lib/supabase', () => ({ supabase: { channel, removeChannel } }));

  const presence = await import('$lib/presence');
  const harness: Harness = { auth, settings, timer, groups, channels, channel, removeChannel };
  return { presence, harness };
}

beforeEach(() => {
  vi.resetModules();
});

describe('presence lifecycle', () => {
  it('tracks only authenticated users with sharing enabled in approved groups', async () => {
    const pending = { ...approvedGroup('pending'), status: 'pending' as const };
    const { presence, harness } = await setup({ groups: [approvedGroup('approved'), pending] });

    presence.startPresence();
    presence.startPresence();

    expect(harness.channel).toHaveBeenCalledTimes(1);
    expect(harness.channel).toHaveBeenCalledWith('group-presence:approved', {
      config: { presence: { key: 'user-1' } },
    });
    harness.channels[0].emitSubscribed();
    expect(harness.channels[0].track).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Mali',
      status: 'idle',
    });
  });

  it('does not create channels in guest mode', async () => {
    const { presence, harness } = await setup({ authenticated: false });
    presence.startPresence();
    expect(harness.channel).not.toHaveBeenCalled();
  });

  it('joins approved groups while sharing is disabled without tracking self', async () => {
    const { presence, harness } = await setup({ shareActivity: false });
    presence.startPresence();
    expect(harness.channel).toHaveBeenCalledTimes(1);
    harness.channels[0].emitSubscribed();
    expect(harness.channels[0].track).not.toHaveBeenCalled();

    harness.settings.set({ shareActivity: true });
    expect(harness.channel).toHaveBeenCalledTimes(1);
    expect(harness.channels[0].track).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Mali',
      status: 'idle',
    });
  });

  it('rebroadcasts only when the derived status changes, with exam taking precedence', async () => {
    const { presence, harness } = await setup();
    presence.startPresence();
    harness.channels[0].emitSubscribed();
    harness.channels[0].track.mockClear();

    harness.timer.set({ status: 'idle', elapsed: 1 });
    expect(harness.channels[0].track).not.toHaveBeenCalled();

    harness.timer.set({ status: 'running' });
    expect(harness.channels[0].track).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'studying' }));

    presence.setExamActive(true);
    expect(harness.channels[0].track).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'exam' }));

    harness.timer.set({ status: 'paused' });
    expect(harness.channels[0].track).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'exam' }));

    presence.setExamActive(false);
    expect(harness.channels[0].track).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'idle' }));
  });

  it('reconciles approved groups and fully cleans up on stop', async () => {
    const { presence, harness } = await setup();
    presence.startPresence();
    const first = harness.channels[0];

    harness.groups.set([approvedGroup('group-2')]);
    expect(first.untrack).toHaveBeenCalledTimes(1);
    expect(harness.removeChannel).toHaveBeenCalledWith(first);
    expect(harness.channel).toHaveBeenCalledTimes(2);

    presence.stopPresence();
    expect(harness.channels[1].untrack).toHaveBeenCalledTimes(1);
    expect(harness.removeChannel).toHaveBeenCalledWith(harness.channels[1]);

    harness.groups.set([approvedGroup('group-3')]);
    expect(harness.channel).toHaveBeenCalledTimes(2);
  });

  it('untracks self while sharing is off but keeps the channel subscribed', async () => {
    const { presence, harness } = await setup();
    presence.startPresence();
    const first = harness.channels[0];
    first.emitSubscribed();
    first.untrack.mockClear();

    harness.settings.set({ shareActivity: false });
    expect(first.untrack).toHaveBeenCalledTimes(1);
    expect(harness.removeChannel).not.toHaveBeenCalled();

    harness.settings.set({ shareActivity: true });
    expect(harness.channel).toHaveBeenCalledTimes(1);
    expect(first.track).toHaveBeenCalledTimes(2);
  });

  it('publishes synced member statuses and clears them with channel teardown', async () => {
    const { presence, harness } = await setup();
    presence.startPresence();
    const first = harness.channels[0];
    first.setPresenceState({
      'user-2': [{ userId: 'user-2', name: 'Nok', status: 'studying', presence_ref: 'a' }],
      'user-3': [{ userId: 'user-3', name: 'Beam', status: 'exam', presence_ref: 'b' }],
    });
    first.emitPresenceSync();

    expect(get(presence.groupPresence)).toEqual({
      'group-1': { 'user-2': 'studying', 'user-3': 'exam' },
    });

    harness.groups.set([approvedGroup('group-2')]);
    expect(get(presence.groupPresence)).toEqual({});

    harness.channels[1].setPresenceState({
      'user-4': [{ userId: 'user-4', name: 'Pim', status: 'idle', presence_ref: 'c' }],
    });
    harness.channels[1].emitPresenceSync();
    expect(get(presence.groupPresence)).toEqual({ 'group-2': { 'user-4': 'idle' } });

    presence.stopPresence();
    expect(get(presence.groupPresence)).toEqual({});
  });
});
