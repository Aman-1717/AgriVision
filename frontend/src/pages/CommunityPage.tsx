import { useQuery } from '@tanstack/react-query'
import { Show, useAuth } from '@clerk/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { parseJson } from '../lib/api'
import { useApiFetch } from '../hooks/useApiFetch'

type Tab = 'forum' | 'qa' | 'stories' | 'groups' | 'knowledge'

type Post = {
  id: number
  title: string
  content: string
  author: string
  category: string
  comments_count: number
  created_at: string
}

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'forum', label: 'Forum' },
  { id: 'qa', label: 'Q&A' },
  { id: 'stories', label: 'Stories' },
  { id: 'groups', label: 'Groups' },
  { id: 'knowledge', label: 'Knowledge' },
]

export function CommunityPage() {
  const [tab, setTab] = useState<Tab>('forum')
  const { isSignedIn } = useAuth()
  const authFetch = useApiFetch()

  const forumQ = useForumQuery(tab)
  const qaQ = useQuestionsQuery(tab)
  const groupsQ = useGroupsQuery(tab)
  const storiesQ = useStoriesQuery(tab)
  const knowledgeQ = useKnowledgeQuery(tab)

  async function createPost() {
    if (!isSignedIn) {
      toast.error('Sign in to post')
      return
    }
    const title = window.prompt('Post title')
    if (!title?.trim()) return
    const content = window.prompt('Content')
    if (!content?.trim()) return
    try {
      const res = await authFetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), category: 'general' }),
      })
      const j = await parseJson<{ detail?: string }>(res)
      if (!res.ok) throw new Error(j.detail || 'Failed')
      toast.success('Post created')
      forumQ.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Community</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">Forum threads, regional groups, and shared grow knowledge.</p>
        </div>
        <Show when="signed-in">
          {tab === 'forum' && (
            <button
              type="button"
              onClick={createPost}
              className="ds-btn-primary rounded-xl px-4 py-2 text-sm"
            >
              New post
            </button>
          )}
        </Show>
      </header>
      <Show when="signed-out">
        <p className="rounded-xl border border-ds-border bg-void-2/50 px-4 py-3 text-sm text-ink-muted">
          Sign in to post, join groups, and sync your profile with the API.
        </p>
      </Show>
      <TabRow tab={tab} setTab={setTab} />
      <Panels
        tab={tab}
        forumQ={forumQ}
        qaQ={qaQ}
        groupsQ={groupsQ}
        storiesQ={storiesQ}
        knowledgeQ={knowledgeQ}
        authFetch={authFetch}
      />
    </div>
  )
}

function TabRow({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-ds-border pb-2">
      {TAB_LABELS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTab(t.id)}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            tab === t.id
              ? 'border border-ds-border-accent/40 bg-indigo-cta/20 text-ink shadow-[0_0_0_1px_rgba(94,106,210,0.25)]'
              : 'text-ink-muted hover:bg-surface-ds hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function useForumQuery(tab: Tab) {
  return useQuery({
    queryKey: ['community', 'posts'],
    enabled: tab === 'forum',
    queryFn: async () => {
      const res = await fetch('/api/community/posts')
      return parseJson<{ posts: Post[] }>(res)
    },
  })
}

function useQuestionsQuery(tab: Tab) {
  return useQuery({
    queryKey: ['community', 'questions'],
    enabled: tab === 'qa',
    queryFn: async () => {
      const res = await fetch('/api/community/questions')
      return parseJson<{
        questions: { id: number; title: string; content: string; author: string; is_answered: boolean }[]
      }>(res)
    },
  })
}

function useGroupsQuery(tab: Tab) {
  return useQuery({
    queryKey: ['community', 'groups'],
    enabled: tab === 'groups',
    queryFn: async () => {
      const res = await fetch('/api/community/groups')
      return parseJson<{
        groups: {
          id: number
          name: string
          region: string
          member_count: number
          description?: string
        }[]
      }>(res)
    },
  })
}

function useStoriesQuery(tab: Tab) {
  return useQuery({
    queryKey: ['community', 'stories'],
    enabled: tab === 'stories',
    queryFn: async () => {
      const res = await fetch('/api/community/success-stories')
      return parseJson<{
        stories: {
          id: number
          title: string
          content: string
          author: string
          crop_type: string
          region: string
          yield_increase: number | null
          likes: number
          created_at: string
        }[]
      }>(res)
    },
  })
}

function useKnowledgeQuery(tab: Tab) {
  return useQuery({
    queryKey: ['community', 'knowledge'],
    enabled: tab === 'knowledge',
    queryFn: async () => {
      const res = await fetch('/api/community/knowledge')
      return parseJson<{
        articles: {
          id: number
          title: string
          content: string
          author: string
          category: string
          tags: string[]
          is_featured: boolean
          created_at: string
        }[]
      }>(res)
    },
  })
}

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>

function Panels({
  tab,
  forumQ,
  qaQ,
  groupsQ,
  storiesQ,
  knowledgeQ,
  authFetch,
}: {
  tab: Tab
  forumQ: ReturnType<typeof useForumQuery>
  qaQ: ReturnType<typeof useQuestionsQuery>
  groupsQ: ReturnType<typeof useGroupsQuery>
  storiesQ: ReturnType<typeof useStoriesQuery>
  knowledgeQ: ReturnType<typeof useKnowledgeQuery>
  authFetch: AuthFetch
}) {
  if (tab === 'forum') return <ForumPanel q={forumQ} onRetry={() => forumQ.refetch()} />
  if (tab === 'qa') return <QAPanel q={qaQ} onRetry={() => qaQ.refetch()} />
  if (tab === 'groups') return <GroupsWithJoin q={groupsQ} authFetch={authFetch} />
  if (tab === 'stories') return <StoriesPanel q={storiesQ} onRetry={() => storiesQ.refetch()} />
  return <KnowledgePanel q={knowledgeQ} onRetry={() => knowledgeQ.refetch()} />
}

function ForumPanel({ q, onRetry }: { q: ReturnType<typeof useForumQuery>; onRetry: () => void }) {
  if (q.isLoading) return <SkeletonList />
  if (q.isError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-100">
        Could not load posts.{' '}
        <button type="button" className="font-medium text-red-200 underline" onClick={onRetry}>
          Retry
        </button>
      </div>
    )
  }
  const posts = q.data?.posts ?? []
  if (!posts.length) {
    return <p className="text-sm text-ink-faint">No posts yet. Be the first.</p>
  }
  return (
    <ul className="space-y-3">
      {posts.map((p) => (
        <li key={p.id} className="av-card p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase text-ink-faint">{p.category}</span>
            <span className="text-xs text-ink-faint">{new Date(p.created_at).toLocaleDateString()}</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-ink">{p.title}</h3>
          <p className="mt-2 text-sm text-ink-muted">{p.content}</p>
          <p className="mt-3 text-xs text-ink-faint">
            {p.author} · {p.comments_count} comments
          </p>
        </li>
      ))}
    </ul>
  )
}

function QAPanel({ q, onRetry }: { q: ReturnType<typeof useQuestionsQuery>; onRetry: () => void }) {
  if (q.isLoading) return <SkeletonList />
  if (q.isError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-100">
        Could not load questions.{' '}
        <button type="button" className="font-medium text-red-200 underline" onClick={onRetry}>
          Retry
        </button>
      </div>
    )
  }
  const items = q.data?.questions ?? []
  if (!items.length) return <p className="text-sm text-ink-faint">No questions yet.</p>
  return (
    <ul className="space-y-3">
      {items.map((x) => (
        <li key={x.id} className="av-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-ink">{x.title}</h3>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                x.is_answered
                  ? 'border-ds-border-accent/30 bg-indigo-cta/20 text-ink'
                  : 'border-ds-border bg-surface-ds text-ink-muted'
              }`}
            >
              {x.is_answered ? 'Answered' : 'Open'}
            </span>
          </div>
          <p className="mt-2 text-sm text-ink-muted">{x.content}</p>
          <p className="mt-2 text-xs text-ink-faint">{x.author}</p>
        </li>
      ))}
    </ul>
  )
}

function GroupsWithJoin({ q, authFetch }: { q: ReturnType<typeof useGroupsQuery>; authFetch: AuthFetch }) {
  const { isSignedIn } = useAuth()

  async function join(id: number) {
    if (!isSignedIn) {
      toast.error('Sign in to join')
      return
    }
    try {
      const res = await authFetch(`/api/community/groups/${id}/join`, { method: 'POST' })
      const j = await parseJson<{ message?: string; detail?: unknown }>(res)
      if (!res.ok) {
        const err = j.detail
        throw new Error(typeof err === 'string' ? err : 'Join failed')
      }
      toast.success(j.message || 'Joined')
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (q.isLoading) return <SkeletonList />
  const groups = q.data?.groups ?? []
  if (!groups.length) return <p className="text-sm text-ink-faint">No groups listed.</p>
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {groups.map((g) => (
        <li key={g.id} className="av-card flex flex-col p-5">
          <h3 className="font-semibold text-ink">{g.name}</h3>
          <p className="mt-1 text-sm text-ink-faint">{g.region}</p>
          {g.description ? <p className="mt-2 line-clamp-3 text-sm text-ink-muted">{g.description}</p> : null}
          <p className="mt-2 text-xs text-ink-faint">{g.member_count} members</p>
          <button
            type="button"
            onClick={() => join(g.id)}
            className="ds-btn-secondary mt-4 rounded-lg py-2 text-sm"
          >
            Join
          </button>
        </li>
      ))}
    </ul>
  )
}

function StoriesPanel({ q, onRetry }: { q: ReturnType<typeof useStoriesQuery>; onRetry: () => void }) {
  if (q.isLoading) return <SkeletonList />
  if (q.isError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-100">
        Could not load stories.{' '}
        <button type="button" className="font-medium text-red-200 underline" onClick={onRetry}>
          Retry
        </button>
      </div>
    )
  }
  const items = q.data?.stories ?? []
  if (!items.length) return <p className="text-sm text-ink-faint">No success stories yet.</p>
  return (
    <ul className="space-y-3">
      {items.map((s) => (
        <li key={s.id} className="av-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase text-ink-faint">
              {s.crop_type} · {s.region}
            </span>
            <span className="text-xs text-ink-faint">{new Date(s.created_at).toLocaleDateString()}</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-ink">{s.title}</h3>
          <p className="mt-2 text-sm text-ink-muted">{s.content}</p>
          <p className="mt-3 text-xs text-ink-faint">
            {s.author}
            {s.yield_increase != null ? ` · ~${s.yield_increase}% yield change` : ''} · {s.likes} likes
          </p>
        </li>
      ))}
    </ul>
  )
}

function KnowledgePanel({ q, onRetry }: { q: ReturnType<typeof useKnowledgeQuery>; onRetry: () => void }) {
  if (q.isLoading) return <SkeletonList />
  if (q.isError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-100">
        Could not load articles.{' '}
        <button type="button" className="font-medium text-red-200 underline" onClick={onRetry}>
          Retry
        </button>
      </div>
    )
  }
  const items = q.data?.articles ?? []
  if (!items.length) return <p className="text-sm text-ink-faint">No knowledge articles yet.</p>
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="av-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase text-ink-faint">{a.category}</span>
            <div className="flex items-center gap-2">
              {a.is_featured ? (
                <span className="rounded-full border border-amber-500/30 bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-100">
                  Featured
                </span>
              ) : null}
              <span className="text-xs text-ink-faint">{new Date(a.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-ink">{a.title}</h3>
          <p className="mt-2 text-sm text-ink-muted">{a.content}</p>
          <p className="mt-3 text-xs text-ink-faint">
            {a.author}
            {a.tags?.length ? ` · ${a.tags.join(', ')}` : ''}
          </p>
        </li>
      ))}
    </ul>
  )
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-void-2/80" />
      ))}
    </div>
  )
}
