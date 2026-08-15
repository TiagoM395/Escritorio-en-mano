import { useState } from 'react';
import { motion } from 'framer-motion';
import { ControlProvider } from './hooks/useControl';
import Layout from './components/Layout';
import PanelView from './components/views/PanelView';
import ConfigView from './components/views/ConfigView';
import AyudaView from './components/views/AyudaView';
import type { ViewId } from './types';

function Shell() {
  const [view, setView] = useState<ViewId>('panel');

  return (
    <Layout view={view} onNavigate={setView}>
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {view === 'panel' && <PanelView />}
        {view === 'config' && <ConfigView />}
        {view === 'ayuda' && <AyudaView />}
      </motion.div>
    </Layout>
  );
}

export default function App() {
  return (
    <ControlProvider>
      <div className="app-bg" />
      <Shell />
    </ControlProvider>
  );
}
