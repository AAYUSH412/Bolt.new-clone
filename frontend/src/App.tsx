// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './components/Home.tsx'
import Builder from './components/Builder.tsx' // Use the new index file

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/builder" element={<Builder />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App