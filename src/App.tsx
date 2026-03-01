import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Player from './pages/Player';
import Search from './pages/Search';
import Downloads from './pages/Downloads';
import { BottomNav } from './components/BottomNav';
import { PageTransition } from './components/PageTransition';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <PageTransition>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/watch/:type/:id" element={<Player />} />
        </Routes>
      </PageTransition>
      <BottomNav />
    </BrowserRouter>
  );
}

export default App;
