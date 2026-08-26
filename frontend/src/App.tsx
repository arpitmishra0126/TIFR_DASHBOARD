import { Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import { RefreshProvider } from "./context/RefreshContext";
import { ThemeProvider } from "./context/ThemeContext";
import AssessmentProgress from "./routes/AssessmentProgress";
import Demographics from "./routes/Demographics";
import HealthScreening from "./routes/HealthScreening";
import Neurodevelopment from "./routes/Neurodevelopment";
import Overview from "./routes/Overview";
import PhysicalActivity from "./routes/PhysicalActivity";
import Registry from "./routes/Registry";
import ScreenTime from "./routes/ScreenTime";

export default function App() {
  return (
    <ThemeProvider>
      <RefreshProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Overview />} />
            <Route path="/registry" element={<Registry />} />
            <Route path="/demographics" element={<Demographics />} />
            <Route path="/health-screening" element={<HealthScreening />} />
            <Route path="/physical-activity" element={<PhysicalActivity />} />
            <Route path="/screen-time" element={<ScreenTime />} />
            <Route path="/neurodevelopment" element={<Neurodevelopment />} />
            <Route path="/progress" element={<AssessmentProgress />} />
          </Route>
        </Routes>
      </RefreshProvider>
    </ThemeProvider>
  );
}
