import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get, writable, type Writable } from 'svelte/store';
import type { AuthState } from '$lib/stores/auth';
import type { GroupSummary } from '$lib/groups';

interface TestChannel {
  subscribe: ReturnType<typeof vi.fn>;
  track: ReturnType<typeof vi.fn>;
  untrack: ReturnType<typeof vi.fn>;
  emitSubscribed(): void;
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
    const instance: TestChannel = {
      subscribe: vi.fn((callback: (status: string) => void) => {
        subscriptionCallback = callback;
        return instance;
      }),
      track: vi.fn().mockResolvedValue('ok'),
      untrack: vi.fn().mockResolvedValue('ok'),
      emitSubscribed: () => subscriptionCallback?.('SUBSCRIBED'),
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

  it('starts after sharing is enabled', async () => {
    const { presence, harness } = await setup({ shareActivity: false });
    presence.startPresence();
    expect(harness.channel).not.toHaveBeenCalled();

    harness.settings.set({ shareActivity: true });
    expect(harness.channel).toHaveBeenCalledTimes(1);
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

  it('tears down channels while sharing is off and recreates them when enabled again', async () => {
    const { presence, harness } = await setup();
    presence.startPresence();
    const first = harness.channels[0];

    harness.settings.set({ shareActivity: false });
    expect(first.untrack).toHaveBeenCalledTimes(1);
    expect(harness.removeChannel).toHaveBeenCalledWith(first);

    harness.settings.set({ shareActivity: true });
    expect(harness.channel).toHaveBeenCalledTimes(2);
  });
});
