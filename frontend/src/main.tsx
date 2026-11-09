import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './styles/global.css'
import HomePage from './pages/HomePage/HomePage.tsx'
import DetailPage from './pages/DetailPage/DetailPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/show/:uuid" element={<DetailPage />} />
        <Route path="/movie/:uuid" element={<DetailPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
