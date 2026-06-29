import { useEffect, useState } from 'react'
import './App.css'
import { isSupabaseConfigured, supabase } from './supabaseClient'

const CLIENT_ID_KEY = 'idea-card:client-id'
const STORAGE_KEY = 'idea-card:ideas'

const getClientId = () => {
  const storedClientId = localStorage.getItem(CLIENT_ID_KEY)
  if (storedClientId) return storedClientId

  const clientId = crypto.randomUUID()
  localStorage.setItem(CLIENT_ID_KEY, clientId)
  return clientId
}

const normalizeComment = (comment) => ({
  id: comment.id,
  content: comment.content,
  clientId: comment.clientId ?? comment.client_id ?? '',
})

const normalizeLocalIdea = (idea) => {
  const liked =
    idea.liked === true || (idea.liked !== false && Number(idea.likes) > 0)
  const comments = Array.isArray(idea.comments)
    ? idea.comments
        .filter(
          (comment) =>
            comment &&
            typeof comment.id === 'string' &&
            typeof comment.content === 'string',
        )
        .map(normalizeComment)
    : []

  return {
    id: idea.id,
    content: idea.content,
    liked,
    likes: liked ? 1 : 0,
    comments,
  }
}

const loadStoredIdeas = () => {
  try {
    const storedIdeas = localStorage.getItem(STORAGE_KEY)
    if (!storedIdeas) return []

    const parsedIdeas = JSON.parse(storedIdeas)
    if (!Array.isArray(parsedIdeas)) return []

    return parsedIdeas
      .filter(
        (idea) =>
          idea &&
          typeof idea.id === 'string' &&
          typeof idea.content === 'string',
      )
      .map(normalizeLocalIdea)
  } catch {
    return []
  }
}

const saveStoredIdeas = (ideas) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas))
}

function App() {
  const [clientId] = useState(getClientId)
  const [ideaText, setIdeaText] = useState('')
  const [commentDrafts, setCommentDrafts] = useState({})
  const [ideas, setIdeas] = useState(() =>
    isSupabaseConfigured ? [] : loadStoredIdeas(),
  )
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (isSupabaseConfigured) return
    saveStoredIdeas(ideas)
  }, [ideas])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const fetchIdeas = async () => {
      setIsLoading(true)
      setErrorMessage('')

      const { data: ideaRows, error: ideasError } = await supabase
        .from('ideas')
        .select('id, content, created_at')
        .order('created_at', { ascending: false })

      if (ideasError) {
        setErrorMessage('아이디어를 불러오지 못했습니다.')
        setIsLoading(false)
        return
      }

      const ideaIds = ideaRows.map((idea) => idea.id)
      const { data: likeRows, error: likesError } = ideaIds.length
        ? await supabase
            .from('idea_likes')
            .select('idea_id, client_id')
            .in('idea_id', ideaIds)
        : { data: [], error: null }

      if (likesError) {
        setErrorMessage('좋아요 정보를 불러오지 못했습니다.')
        setIsLoading(false)
        return
      }

      const { data: fetchedCommentRows, error: commentsError } = ideaIds.length
        ? await supabase
            .from('idea_comments')
            .select('id, idea_id, content, client_id, created_at')
            .in('idea_id', ideaIds)
            .order('created_at', { ascending: true })
        : { data: [], error: null }

      const commentRows = fetchedCommentRows ?? []
      if (commentsError) {
        setErrorMessage('Supabase에 댓글 테이블을 만든 뒤 다시 시도해주세요.')
      }

      const likeCounts = new Map()
      const likedIdeaIds = new Set()
      const commentsByIdeaId = new Map()

      likeRows.forEach((like) => {
        likeCounts.set(like.idea_id, (likeCounts.get(like.idea_id) ?? 0) + 1)

        if (like.client_id === clientId) {
          likedIdeaIds.add(like.idea_id)
        }
      })

      commentRows.forEach((comment) => {
        const comments = commentsByIdeaId.get(comment.idea_id) ?? []
        comments.push(normalizeComment(comment))
        commentsByIdeaId.set(comment.idea_id, comments)
      })

      setIdeas(
        ideaRows.map((idea) => ({
          id: idea.id,
          content: idea.content,
          liked: likedIdeaIds.has(idea.id),
          likes: likeCounts.get(idea.id) ?? 0,
          comments: commentsByIdeaId.get(idea.id) ?? [],
        })),
      )
      setIsLoading(false)
    }

    fetchIdeas()
  }, [clientId])

  const addIdea = async (event) => {
    event.preventDefault()

    const trimmedText = ideaText.trim()
    if (!trimmedText) return

    if (isSupabaseConfigured) {
      setErrorMessage('')

      const { data, error } = await supabase
        .from('ideas')
        .insert({ content: trimmedText })
        .select('id, content')
        .single()

      if (error) {
        setErrorMessage('아이디어를 저장하지 못했습니다.')
        return
      }

      setIdeas((currentIdeas) => [
        {
          id: data.id,
          content: data.content,
          liked: false,
          likes: 0,
          comments: [],
        },
        ...currentIdeas,
      ])
    } else {
      setIdeas((currentIdeas) => [
        {
          id: crypto.randomUUID(),
          content: trimmedText,
          liked: false,
          likes: 0,
          comments: [],
        },
        ...currentIdeas,
      ])
    }

    setIdeaText('')
  }

  const toggleLike = async (id) => {
    const selectedIdea = ideas.find((idea) => idea.id === id)
    if (!selectedIdea) return

    if (isSupabaseConfigured) {
      setErrorMessage('')

      if (selectedIdea.liked) {
        const { error } = await supabase
          .from('idea_likes')
          .delete()
          .eq('idea_id', id)
          .eq('client_id', clientId)

        if (error) {
          setErrorMessage('좋아요를 취소하지 못했습니다.')
          return
        }
      } else {
        const { error } = await supabase.from('idea_likes').insert({
          idea_id: id,
          client_id: clientId,
        })

        if (error) {
          setErrorMessage('좋아요를 저장하지 못했습니다.')
          return
        }
      }
    }

    setIdeas((currentIdeas) =>
      currentIdeas.map((idea) => {
        if (idea.id !== id) return idea

        const liked = !idea.liked
        return {
          ...idea,
          liked,
          likes: liked ? idea.likes + 1 : Math.max(idea.likes - 1, 0),
        }
      }),
    )
  }

  const deleteIdea = async (id) => {
    if (isSupabaseConfigured) {
      setErrorMessage('')

      const { error } = await supabase.from('ideas').delete().eq('id', id)
      if (error) {
        setErrorMessage('아이디어를 삭제하지 못했습니다.')
        return
      }
    }

    setIdeas((currentIdeas) => currentIdeas.filter((idea) => idea.id !== id))

    if (editingId === id) {
      setEditingId(null)
      setEditingText('')
    }
  }

  const startEditing = (idea) => {
    setEditingId(idea.id)
    setEditingText(idea.content)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingText('')
  }

  const saveEditing = async (id) => {
    const trimmedText = editingText.trim()
    if (!trimmedText) return

    if (isSupabaseConfigured) {
      setErrorMessage('')

      const { error } = await supabase
        .from('ideas')
        .update({ content: trimmedText })
        .eq('id', id)

      if (error) {
        setErrorMessage('아이디어를 수정하지 못했습니다.')
        return
      }
    }

    setIdeas((currentIdeas) =>
      currentIdeas.map((idea) =>
        idea.id === id ? { ...idea, content: trimmedText } : idea,
      ),
    )
    cancelEditing()
  }

  const updateCommentDraft = (ideaId, value) => {
    setCommentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [ideaId]: value,
    }))
  }

  const addComment = async (event, ideaId) => {
    event.preventDefault()

    const trimmedComment = (commentDrafts[ideaId] ?? '').trim()
    if (!trimmedComment) return

    let newComment = {
      id: crypto.randomUUID(),
      content: trimmedComment,
      clientId,
    }

    if (isSupabaseConfigured) {
      setErrorMessage('')

      const { data, error } = await supabase
        .from('idea_comments')
        .insert({
          idea_id: ideaId,
          content: trimmedComment,
          client_id: clientId,
        })
        .select('id, content, client_id')
        .single()

      if (error) {
        setErrorMessage('댓글을 저장하지 못했습니다.')
        return
      }

      newComment = normalizeComment(data)
    }

    setIdeas((currentIdeas) =>
      currentIdeas.map((idea) =>
        idea.id === ideaId
          ? { ...idea, comments: [...idea.comments, newComment] }
          : idea,
      ),
    )
    updateCommentDraft(ideaId, '')
  }

  const deleteComment = async (ideaId, commentId) => {
    if (isSupabaseConfigured) {
      setErrorMessage('')

      const { error } = await supabase
        .from('idea_comments')
        .delete()
        .eq('id', commentId)

      if (error) {
        setErrorMessage('댓글을 삭제하지 못했습니다.')
        return
      }
    }

    setIdeas((currentIdeas) =>
      currentIdeas.map((idea) =>
        idea.id === ideaId
          ? {
              ...idea,
              comments: idea.comments.filter((comment) => comment.id !== commentId),
            }
          : idea,
      ),
    )
  }

  return (
    <main className="board-shell">
      <section className="board-header" aria-labelledby="board-title">
        <div>
          <p className="eyebrow">Idea Board</p>
          <h1 id="board-title">생각을 카드로 모아두세요</h1>
        </div>
        <span className="idea-count" aria-label={`아이디어 ${ideas.length}개`}>
          {ideas.length}
        </span>
      </section>

      <form className="idea-form" onSubmit={addIdea}>
        <label htmlFor="idea-input">아이디어 입력</label>
        <div className="input-row">
          <textarea
            id="idea-input"
            value={ideaText}
            onChange={(event) => setIdeaText(event.target.value)}
            placeholder="새 아이디어를 적어보세요"
            rows="3"
          />
          <button type="submit">저장</button>
        </div>
      </form>

      {errorMessage ? <p className="error-message">{errorMessage}</p> : null}

      <section className="idea-list" aria-live="polite">
        {isLoading ? (
          <div className="empty-state">
            <h2>아이디어를 불러오는 중이에요</h2>
            <p>잠시만 기다려주세요.</p>
          </div>
        ) : ideas.length === 0 ? (
          <div className="empty-state">
            <h2>아직 저장된 아이디어가 없어요</h2>
            <p>첫 아이디어를 기다리고 있어요.</p>
          </div>
        ) : (
          ideas.map((idea) => (
            <article className="idea-card" key={idea.id}>
              {editingId === idea.id ? (
                <>
                  <textarea
                    className="edit-input"
                    value={editingText}
                    onChange={(event) => setEditingText(event.target.value)}
                    aria-label="아이디어 내용 수정"
                    rows="4"
                  />
                  <div className="card-actions">
                    <button type="button" onClick={() => saveEditing(idea.id)}>
                      완료
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={cancelEditing}
                    >
                      취소
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>{idea.content}</p>
                  <div className="card-footer">
                    <button
                      className={`like-button ${idea.liked ? 'is-liked' : ''}`}
                      type="button"
                      onClick={() => toggleLike(idea.id)}
                      aria-pressed={idea.liked}
                      aria-label={
                        idea.liked
                          ? `좋아요 취소, 현재 ${idea.likes}개`
                          : `좋아요, 현재 ${idea.likes}개`
                      }
                    >
                      <span aria-hidden="true">♥</span>
                      {idea.likes}
                    </button>
                    <div className="card-actions">
                      <button type="button" onClick={() => startEditing(idea)}>
                        수정
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => deleteIdea(idea.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  <section className="comment-section" aria-label="댓글">
                    <div className="comment-header">
                      <h2>댓글</h2>
                      <span>{idea.comments.length}</span>
                    </div>

                    {idea.comments.length > 0 ? (
                      <ul className="comment-list">
                        {idea.comments.map((comment) => (
                          <li className="comment-item" key={comment.id}>
                            <span>{comment.content}</span>
                            <button
                              className="comment-delete"
                              type="button"
                              onClick={() => deleteComment(idea.id, comment.id)}
                              aria-label="댓글 삭제"
                            >
                              삭제
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="comment-empty">아직 댓글이 없어요.</p>
                    )}

                    <form
                      className="comment-form"
                      onSubmit={(event) => addComment(event, idea.id)}
                    >
                      <input
                        type="text"
                        value={commentDrafts[idea.id] ?? ''}
                        onChange={(event) =>
                          updateCommentDraft(idea.id, event.target.value)
                        }
                        placeholder="댓글을 입력하세요"
                        aria-label="댓글 입력"
                      />
                      <button type="submit">등록</button>
                    </form>
                  </section>
                </>
              )}
            </article>
          ))
        )}
      </section>
    </main>
  )
}

export default App
