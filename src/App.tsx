import { Route, Routes } from 'react-router-dom'
import { DuelRoom } from './pages/DuelRoom'
import { Home } from './pages/Home'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/d/:id" element={<DuelRoom />} />
    </Routes>
  )
}
