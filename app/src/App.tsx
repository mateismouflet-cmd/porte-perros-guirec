import { HashRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Predictions from './pages/Predictions'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/previsions" element={<Predictions />} />
      </Routes>
    </HashRouter>
  )
}
