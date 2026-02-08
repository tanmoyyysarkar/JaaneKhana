import Navbar from './components/Navbar';
import Hero from './components/Hero';
import About from './components/About';
import Demo from './components/Demo';
import Footer from './components/Footer';
import ExplainModal from './components/Explain';
import { ExplainProvider } from './context/ExplainContext';

function App() {

  return (
    <ExplainProvider>
      <ExplainModal />
      <Navbar />
      <Hero />
      <About />
      <Demo />
      <Footer />
    </ExplainProvider>
  )
}

export default App
