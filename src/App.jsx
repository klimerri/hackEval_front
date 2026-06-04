import { BrowserRouter, Route, Routes} from 'react-router-dom';
import { AuthPage } from './pages/AuthPage/AuthPage';
import { StylePage } from './pages/StylePage/StylePage';

function App() {

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/style" element={<StylePage />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
