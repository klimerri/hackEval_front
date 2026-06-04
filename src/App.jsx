import { BrowserRouter, Route, Routes} from 'react-router-dom';
import { AuthPage } from './pages/AuthPage/AuthPage';
import { StylePage } from './pages/StylePage/StylePage';
import { LayoutWithDrawer } from './components/LayoutWithDrawer/LayoutWithDrawer';

function App() {

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage />} />

          <Route path="/" element={<LayoutWithDrawer />}>
            <Route path="/style" element={<StylePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
