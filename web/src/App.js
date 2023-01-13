import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link
} from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Dashboard from './Dashboard'

function App() {
  return (
    <Container>
      <h1>
        dolphin testnet v3
      </h1>
      <Routes>
        <Route path='/' element={ <Dashboard /> } />
        <Route path='/status/:address' element={ <h2>{`wallet address`}</h2> } />
      </Routes>
    </Container>
  );
}

export default App;
