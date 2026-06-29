import { useEffect, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'idea-card:ideas'

const loadStoredIdeas = () => {
  try {
    const storedIdeas = localStorage.getItem(STORAGE_KEY)
    if (!storedIdeas) return []

    const parsedIdeas = JSON.parse(storedIdeas)
    if (!Array.isArray(parsedIdeas)) return []

    return parsedIdeas.filter(
      (idea) =>
        idea &&
        typeof idea.id === 'string' &&
        typeof idea.content === 'string',
    )
  } catch {
    return []
  }
}

function App() {
  const [ideaText, setIdeaText] = useState('')
  const [ideas, setIdeas] = useState(loadStoredIdeas)
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas))
  }, [ideas])

  const addIdea = (event) => {
    event.preventDefault()

    const trimmedText = ideaText.trim()
    if (!trimmedText) return

    setIdeas((currentIdeas) => [
      {
        id: crypto.randomUUID(),
        content: trimmedText,
      },
      ...currentIdeas,
    ])
    setIdeaText('')
  }

  const deleteIdea = (id) => {
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

  const saveEditing = (id) => {
    const trimmedText = editingText.trim()
    if (!trimmedText) return

    setIdeas((currentIdeas) =>
      currentIdeas.map((idea) =>
        idea.id === id ? { ...idea, content: trimmedText } : idea,
      ),
    )
    cancelEditing()
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

      <section className="idea-list" aria-live="polite">
        {ideas.length === 0 ? (
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
