/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, memo, useMemo, useRef } from 'react';
import ReactFlow, { 
  useNodesState, useEdgesState, addEdge, Panel, Background, Controls,
  Handle, Position, ConnectionMode, useReactFlow, ReactFlowProvider, BackgroundVariant,
  MarkerType, SelectionMode, getRectOfNodes
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  X, Droplets, Gauge, Waves, Beaker, Ban, Activity, 
  FileText, Copy, Droplet, Trash2, Plus, Zap, ArrowDown, MoveRight, Layers, Download, Upload, Clock, Database, ShieldAlert, Cloud, CloudOff, RefreshCw, FileDown, Printer
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { toPng, toJpeg, toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

// ==========================================
// CONFIGURAÇÃO DE VERSÃO DE DESENVOLVIMENTO
// ==========================================
const DEV_VERSION = 'v1.9.8'; 
const STORAGE_KEY = 'fluxo_agua_v88_deso';

const globalStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { font-family: 'Inter', sans-serif; color: #1e293b; background: #f8fafc; user-select: none; overflow: hidden; }
  .react-flow__edge-path { stroke-linecap: round; transition: stroke 0.3s, stroke-width 0.3s; stroke-width: 4; }
  .react-flow__edge.selected .react-flow__edge-path { stroke-width: 6; stroke: #1e293b !important; }
  .react-flow__edge-text { fill: #1e293b; font-size: 13px; font-weight: 800; pointer-events: none; }
  .react-flow__edge-textbg { fill: white !important; fill-opacity: 1 !important; }
  .react-flow__handle { width: 10px !important; height: 10px !important; background: #cbd5e1 !important; border: 2px solid white !important; }
  .react-flow__selection { background: rgba(37, 99, 235, 0.1); border: 1px solid #2563eb; }
  
  /* Custom Scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

  @keyframes glowPulse {
    0% { box-shadow: 0 0 0 0px rgba(59, 130, 246, 0.4); }
    70% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
    100% { box-shadow: 0 0 0 0px rgba(59, 130, 246, 0); }
  }
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .node-selected-pulse { animation: glowPulse 2s infinite; border-color: #3b82f6 !important; }
  .bottom-sheet-enter { animation: slideUp 0.3s ease-out; }
  .fade-in { animation: fadeIn 0.2s ease-out; }
  
  .search-input-container {
    position: relative;
    width: 100%;
  }
  .search-input-container input {
    width: 100%;
    padding: 10px 12px 10px 36px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    font-size: 13px;
    outline: none;
    transition: all 0.2s;
    background: #f8fafc;
  }
  .search-input-container input:focus {
    border-color: #3b82f6;
    background: white;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.08);
  }
  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
  }
  
  /* Mobile UI Overrides */
  @media (max-width: 768px) {
    .react-flow__controls {
      display: flex;
      flex-direction: row !important;
      bottom: 20px !important;
      left: 50% !important;
      transform: translateX(-50%);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
      border: none !important;
      background: white !important;
      border-radius: 12px !important;
      padding: 4px !important;
    }
    .react-flow__controls-button {
      border-right: 1px solid #f1f5f9 !important;
      border-bottom: none !important;
      width: 36px !important;
      height: 36px !important;
    }
    .react-flow__controls-button:last-child { border-right: none !important; }
  }
`;

// Função auxiliar para gerar ID único (UUID)
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const NodeCustomizado = memo(({ data, selected }: any) => {
  const icons: any = { 
    'Captação': <Waves size={14} />, 'Tratamento': <Beaker size={14} />, 
    'Macromedidor': <Gauge size={14} />, 'Armazenamento': <Droplets size={14} />, 
    'Descarte': <Ban size={14} />, 'Iguá': <Droplet size={14} fill="white" /> 
  };
  
  const isHighlighted = data.highlighted;

  return (
    <div className={`${selected ? 'node-selected-pulse' : ''} ${isHighlighted ? 'node-search-highlight' : ''}`} style={{ 
      background: '#fff', borderRadius: '14px', border: selected ? `2px solid ${data.cor}` : (isHighlighted ? '3px solid #f59e0b' : '1px solid #e2e8f0'),
      width: '210px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: isHighlighted ? '0 0 15px rgba(245, 158, 11, 0.5)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ background: data.cor, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', color: 'white' }}>
        {icons[data.tipo] || <Activity size={14} />}
        <div style={{ fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>{data.label}</div>
      </div>
      <div style={{ padding: '12px', background: 'white', textAlign: 'center', borderTop: '1px solid #f1f5f9', minHeight: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>{data.nodeId || ""}</div>
        
        {data.tipo === 'Tratamento' && (data.concessionaria || data.uc || data.medidor) && (
          <>
            <div style={{ width: '100%', height: '1px', background: '#94a3b8', margin: '4px 0' }} />
            <div style={{ fontSize: '10px', color: '#334155', textAlign: 'left', width: '100%', display: 'flex', flexDirection: 'column', gap: '2px', textTransform: 'uppercase', fontWeight: 700 }}>
              {data.concessionaria && <div>Css. {data.concessionaria}</div>}
              {data.uc && <div>UC {data.uc}</div>}
              {data.medidor && <div>Med. {data.medidor}</div>}
            </div>
          </>
        )}
      </div>
      <Handle type="source" position={Position.Top} id="t" /><Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" /><Handle type="source" position={Position.Right} id="r" />
    </div>
  );
});

const nodeTypes = { custom: NodeCustomizado };

const FlowContent = () => {
  const [projetos, setProjetos] = useState<any[]>([]);
  const [projetoAtivoId, setProjetoAtivoId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [supabaseConfigured] = useState(() => isSupabaseConfigured());
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [termoPesquisaProjetos, setTermoPesquisaProjetos] = useState('');
  const [termoPesquisaElementos, setTermoPesquisaElementos] = useState('');
  const [ordenacao, setOrdenacao] = useState<'nome' | 'data'>('data');
  const [showModalNovo, setShowModalNovo] = useState(false);
  
  // Função robusta para detectar se é um dispositivo móvel
  const checkIsMobile = useCallback(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isMobileUA = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    const isSmallScreen = window.innerWidth <= 768;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Consideramos mobile se for um User Agent de celular/tablet OU se a tela for pequena E tiver touch
    return isMobileUA || (isSmallScreen && hasTouch);
  }, []);

  const [isMobileView, setIsMobileView] = useState(checkIsMobile());
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [nomeNovoProjeto, setNomeNovoProjeto] = useState('');
  const [erroModal, setErroModal] = useState('');
  const [modalConfig, setModalConfig] = useState<{
    show: boolean;
    tipo: 'aviso' | 'confirmacao';
    titulo: string;
    mensagem: string | React.ReactNode;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({ show: false, tipo: 'aviso', titulo: '', mensagem: '' });

  useEffect(() => {
    const handleResize = () => {
      const mobile = checkIsMobile();
      setIsMobileView(mobile);
      setIsLandscape(window.innerWidth > window.innerHeight);
      if (mobile) setModoEdicao(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkIsMobile]);

  useEffect(() => {
    if (isMobileView) setModoEdicao(false);
  }, [isMobileView]);

  const mostrarAviso = (titulo: string, mensagem: string | React.ReactNode) => {
    setModalConfig({ show: true, tipo: 'aviso', titulo, mensagem });
  };

  const mostrarConfirmacao = (titulo: string, mensagem: string | React.ReactNode, onConfirm: () => void) => {
    setModalConfig({ show: true, tipo: 'confirmacao', titulo, mensagem, onConfirm });
  };

  const fecharModalGeral = () => {
    setModalConfig(prev => ({ ...prev, show: false }));
  };

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const projetosRef = useRef(projetos);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { projetosRef.current = projetos; }, [projetos]);

  const addDebugLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setDebugLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 10));
    console.log(`[Supabase Debug] ${msg}`);
  }, []);
  
  const isDragging = useRef(false);
  const nodeOffsetRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const globalBackupRef = useRef<HTMLInputElement>(null);
  const { setCenter, fitView, deleteElements, fitBounds, getViewport, setViewport } = useReactFlow();

  const nodesSelecionados = useMemo(() => nodes.filter(n => n.selected), [nodes]);
  const edgesSelecionadas = useMemo(() => edges.filter(e => e.selected), [edges]);
  const totalSelecionado = nodesSelecionados.length + edgesSelecionadas.length;

  const selecionado = useMemo(() => {
    if (totalSelecionado > 1) {
      return { type: 'bulk', count: totalSelecionado, nodeCount: nodesSelecionados.length, edgeCount: edgesSelecionadas.length };
    } else if (totalSelecionado === 0) {
      return null;
    } else if (nodesSelecionados.length === 1) {
      const node = nodesSelecionados[0];
      return { type: 'node', id: node.id, data: node.data };
    } else if (edgesSelecionadas.length === 1) {
      const edge = edgesSelecionadas[0];
      return { type: 'edge', id: edge.id, data: edge.data };
    }
    return null;
  }, [totalSelecionado, nodesSelecionados, edgesSelecionadas]);

  const centralizarNoPalcoUtil = useCallback((nodesAlvo: any[]) => {
    if (nodesAlvo.length === 0) return;
    const SIDEBAR_WIDTH = 280;
    const DETAIL_PANEL_WIDTH = 300;
    const { zoom } = getViewport();
    const screenOffsetPixels = (SIDEBAR_WIDTH - DETAIL_PANEL_WIDTH) / 2;
    const worldOffset = screenOffsetPixels / zoom;

    if (nodesAlvo.length === 1) {
      const node = nodesAlvo[0];
      setCenter(node.position.x + 105 - worldOffset, node.position.y + 40, { zoom: 1.3, duration: 600 });
    } else {
      const bounds = getRectOfNodes(nodesAlvo);
      fitBounds(bounds, { padding: 0.8, duration: 600 });
    }
  }, [setCenter, fitBounds, getViewport]);

  const onSelectionChange = useCallback((params: any) => {
    // Removido o zoom automático aqui para não atrapalhar o início do arraste
  }, []);

  const onSelectionEnd = useCallback(() => {
    const selectedNodes = nodesRef.current.filter(n => n.selected);
    if (selectedNodes.length > 0) centralizarNoPalcoUtil(selectedNodes);
  }, [centralizarNoPalcoUtil]);

  useEffect(() => {
    const carregarProjetos = async () => {
      if (!supabaseConfigured) {
        console.warn('Supabase não configurado. Usando localStorage.');
        const salvo = localStorage.getItem(STORAGE_KEY);
        if (salvo) {
          const parsed = JSON.parse(salvo);
          setProjetos(parsed);
          if (parsed.length > 0) setProjetoAtivoId(parsed[0].id);
        } else {
          const inicial = { id: `p_${Date.now()}`, nome: 'SISTEMA DESO 01', nodes: [], edges: [] };
          setProjetos([inicial]);
          setProjetoAtivoId(inicial.id);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('projetos')
          .select('*')
          .order('updated_at', { ascending: false });

        if (error) {
          // Se for erro de tabela inexistente
          if (error.code === 'PGRST116' || error.message.includes('relation "projetos" does not exist')) {
            setSupabaseError('Tabela "projetos" não encontrada no Supabase. Crie a tabela para usar a nuvem.');
          } else {
            setSupabaseError(`Erro Supabase: ${error.message}`);
          }
          throw error;
        }

        setSupabaseError(null);
        if (data && data.length > 0) {
          setProjetos(data);
          if (data[0].id) setProjetoAtivoId(data[0].id);
        } else {
          // Se não houver projetos no Supabase, tenta migrar do localStorage ou cria um inicial
          const salvo = localStorage.getItem(STORAGE_KEY);
          if (salvo) {
            const parsed = JSON.parse(salvo);
            setProjetos(parsed);
            if (parsed.length > 0) setProjetoAtivoId(parsed[0].id);
          } else {
            const inicial = { id: generateUUID(), nome: 'SISTEMA DESO 01', nodes: [], edges: [], updated_at: new Date().toISOString() };
            const { data: novoData, error: novoError } = await supabase
              .from('projetos')
              .insert([inicial])
              .select();
            
            if (novoError) throw novoError;
            if (novoData) {
              setProjetos(novoData);
              setProjetoAtivoId(novoData[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Erro ao carregar do Supabase:', err);
        setSyncStatus('error');
        // Fallback para localStorage em caso de erro crítico de conexão
        const salvo = localStorage.getItem(STORAGE_KEY);
        if (salvo) {
          const parsed = JSON.parse(salvo);
          setProjetos(parsed);
          if (parsed.length > 0) setProjetoAtivoId(parsed[0].id);
        }
      }
    };

    carregarProjetos();
  }, []);

  useEffect(() => {
    const ativo = projetos.find(p => p.id === projetoAtivoId);
    if (ativo) { 
      setNodes(ativo.nodes || []); 
      setEdges(ativo.edges || []); 
      setTimeout(() => fitView({ padding: 0.4 }), 150); 
    }
  }, [projetoAtivoId, setNodes, setEdges, fitView]);

  const salvarNoSupabase = useCallback(async () => {
    if (!projetoAtivoId) return;
    
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const currentProjetos = projetosRef.current;

    const projetoAtual = currentProjetos.find(p => p.id === projetoAtivoId);
    if (!projetoAtual) return;

    if (!supabaseConfigured) {
      const novaLista = currentProjetos.map(p => p.id === projetoAtivoId ? { ...p, nodes: currentNodes, edges: currentEdges } : p);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(novaLista));
      return;
    }

    setSyncStatus('syncing');
    addDebugLog(`Sincronizando: ${projetoAtual.nome}`);
    
    try {
      const payload = { 
        id: projetoAtivoId, 
        nome: projetoAtual.nome,
        nodes: currentNodes, 
        edges: currentEdges, 
        updated_at: new Date().toISOString() 
      };

      const { error, data, status, statusText } = await supabase
        .from('projetos')
        .upsert(payload, { onConflict: 'id' })
        .select();

      if (error) {
        addDebugLog(`ERRO: ${error.message}`);
        throw error;
      }
      
      if (data && data.length > 0) {
        addDebugLog(`Nuvem atualizada: ${data[0].nome}`);
        setSupabaseError(null);
        setSyncStatus('synced');
      } else {
        setSyncStatus('synced'); 
      }
    } catch (err: any) {
      addDebugLog(`FALHA: ${err.message}`);
      setSupabaseError(`Erro na nuvem: ${err.message || 'Erro de conexão'}`);
      setSyncStatus('error');
    }
    
    const novaLista = currentProjetos.map(p => p.id === projetoAtivoId ? { ...p, nodes: currentNodes, edges: currentEdges } : p);
    setProjetos(novaLista);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novaLista));
  }, [projetoAtivoId, supabaseConfigured, addDebugLog]);

  // Sincronização automática apenas para mudanças nos elementos (nodes/edges)
  useEffect(() => {
    if (nodes.length === 0 && edges.length === 0) return;
    const timer = setTimeout(salvarNoSupabase, 3000);
    return () => clearTimeout(timer);
  }, [nodes, edges, salvarNoSupabase]);

  const projetoAtivo = projetos.find(p => p.id === projetoAtivoId);

  const exportarPDF = useCallback(async () => {
    const flowElement = document.querySelector('.react-flow') as HTMLElement;
    if (!flowElement || nodes.length === 0) return;

    addDebugLog('Iniciando exportação PDF (v2.0.0 - Solução Robusta)...');
    setSyncStatus('syncing');

    try {
      // 1. CÁLCULO DE LIMITES REAIS
      const bounds = getRectOfNodes(nodes);
      const padding = 50;
      const titleHeight = 80;
      
      const virtualWidth = Math.ceil(bounds.width + (padding * 2));
      const virtualHeight = Math.ceil(bounds.height + (padding * 2) + titleHeight);

      // Limite de segurança para evitar canvas gigante que quebra o navegador (max 6000px)
      const maxDim = 6000;
      let scale = 1;
      if (virtualWidth > maxDim || virtualHeight > maxDim) {
        scale = maxDim / Math.max(virtualWidth, virtualHeight);
        addDebugLog(`Aviso: Diagrama muito grande. Reduzindo escala para ${scale.toFixed(2)}x`);
      }

      const finalWidth = virtualWidth * scale;
      const finalHeight = virtualHeight * scale;

      // 2. PREPARAÇÃO DO CLONE (v2.0.0)
      const flowElement = document.querySelector('.react-flow') as HTMLElement;
      if (!flowElement) throw new Error('Elemento React Flow não encontrado');

      // Criamos um container "real" mas fora da tela para o navegador renderizar
      const container = document.createElement('div');
      container.className = 'react-flow-export-container';
      container.style.position = 'absolute';
      container.style.left = '-99999px'; // Fora da tela mas "visível" para o motor
      container.style.top = '0';
      container.style.width = virtualWidth + 'px';
      container.style.height = virtualHeight + 'px';
      container.style.backgroundColor = '#f8fafc';
      container.style.overflow = 'hidden';
      document.body.appendChild(container);

      // Clonamos o elemento
      const clone = flowElement.cloneNode(true) as HTMLElement;
      container.appendChild(clone);
      
      // Ajustamos o clone para ocupar todo o container
      clone.style.width = '100%';
      clone.style.height = '100%';
      clone.style.position = 'relative';

      // Localizamos a viewport interna no clone e forçamos o posicionamento centralizado
      const viewport = clone.querySelector('.react-flow__viewport') as HTMLElement;
      if (viewport) {
        viewport.style.transformOrigin = '0 0';
        const translateX = padding - bounds.x;
        const translateY = padding + titleHeight - bounds.y;
        viewport.style.transform = `translate(${translateX}px, ${translateY}px) scale(1)`;
      }

      // Removemos elementos de interface que não devem sair no PDF
      const toHide = clone.querySelectorAll('.react-flow__controls, .react-flow__attribution, .search-input-container, .react-flow__panel, .react-flow__minimap');
      toHide.forEach(el => (el as HTMLElement).style.display = 'none');

      // 3. AGUARDAR RENDERIZAÇÃO COMPLETA
      addDebugLog('Aguardando renderização e fontes...');
      await document.fonts.ready; // Garante que as fontes do Google foram carregadas
      await new Promise(resolve => setTimeout(resolve, 600)); // Tempo extra para o motor de renderização

      // 4. CAPTURA COMO PNG (Mais robusto que JPEG para SVGs e transparências)
      const dataUrl = await toPng(container, {
        width: virtualWidth,
        height: virtualHeight,
        pixelRatio: scale, // Aplicamos a escala de segurança
        backgroundColor: '#f8fafc',
        cacheBust: true,
        skipFonts: false,
      });

      // Limpamos o container
      document.body.removeChild(container);

      // Validação de segurança: se a imagem for muito pequena, algo deu errado
      if (dataUrl.length < 5000) {
        throw new Error('Falha na captura: A imagem gerada está em branco ou corrompida.');
      }

      // 5. GERAR PDF
      const pdf = new jsPDF({
        orientation: virtualWidth > virtualHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: [finalWidth, finalHeight]
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, finalWidth, finalHeight);

      // 6. ADICIONAR TÍTULO (v2.0.0)
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(26 * scale);
      pdf.setTextColor(15, 23, 42);
      const title = (projetoAtivo?.nome || 'PROJETO').toUpperCase();
      const titleWidth = pdf.getTextWidth(title);
      pdf.text(title, (finalWidth - titleWidth) / 2, 55 * scale);

      const timestamp = gerarTimestamp();
      pdf.save(`fluxograma-${projetoAtivo?.nome || 'projeto'}-${timestamp}.pdf`);
      
      addDebugLog('PDF v2.0.0 gerado com sucesso!');
      setSyncStatus('synced');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      addDebugLog('Erro crítico ao gerar PDF: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
      setSyncStatus('error');
      alert('Erro ao gerar PDF. O diagrama pode ser muito grande ou houve um erro de renderização.');
    }
  }, [nodes, projetoAtivo, addDebugLog]);

  const fecharPainel = useCallback(() => {
    setNodes(nds => nds.map(n => ({ ...n, selected: false })));
    setEdges(eds => eds.map(e => ({ ...e, selected: false })));
  }, [setNodes, setEdges]);

  // Filtragem e Ordenação de projetos (Pesquisa Global em todos os sistemas e elementos)
  const projetosFiltrados = useMemo(() => {
    let lista = [...projetos];
    
    // Filtragem
    if (termoPesquisaProjetos.trim()) {
      const termo = termoPesquisaProjetos.toLowerCase();
      lista = lista.filter(p => {
        // 1. Verifica no nome do projeto
        if (p.nome.toLowerCase().includes(termo)) return true;
        
        // 2. Verifica em todos os nós deste projeto
        const nodes = p.nodes || [];
        return nodes.some((n: any) => {
          const matchLabel = n.data?.label?.toLowerCase().includes(termo);
          const matchDetalhes = n.data?.detalhes?.toLowerCase().includes(termo);
          const matchNodeId = n.data?.nodeId?.toLowerCase().includes(termo);
          return matchLabel || matchDetalhes || matchNodeId;
        });
      });
    }

    // Ordenação
    lista.sort((a, b) => {
      if (ordenacao === 'nome') {
        return a.nome.localeCompare(b.nome);
      } else {
        const dateA = new Date(a.updated_at || 0).getTime();
        const dateB = new Date(b.updated_at || 0).getTime();
        return dateB - dateA; // Decrescente (mais recentes primeiro)
      }
    });

    return lista;
  }, [projetos, termoPesquisaProjetos, ordenacao]);

  // Efeito para destacar nós que correspondem à pesquisa de elementos
  useEffect(() => {
    if (!termoPesquisaElementos.trim()) {
      setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, highlighted: false } })));
      return;
    }
    const termo = termoPesquisaElementos.toLowerCase();
    setNodes(nds => nds.map(n => {
      const matchLabel = n.data.label?.toLowerCase().includes(termo);
      const matchDetalhes = n.data.detalhes?.toLowerCase().includes(termo);
      const matchNodeId = n.data.nodeId?.toLowerCase().includes(termo);
      return { ...n, data: { ...n.data, highlighted: matchLabel || matchDetalhes || matchNodeId } };
    }));
  }, [termoPesquisaElementos, setNodes]);

  const excluirSelecaoTotal = useCallback(async () => {
    deleteElements({ nodes: nodesSelecionados, edges: edgesSelecionadas });
    fecharPainel();
  }, [deleteElements, nodesSelecionados, edgesSelecionadas, fecharPainel]);

  const adicionarNo = (tipo: string, label: string, cor: string) => {
    const id = `node_${Date.now()}`;
    const spacing = 25;
    const currentOffset = (nodeOffsetRef.current % 10) * spacing;
    
    const newNode = {
      id, type: 'custom', 
      position: { x: 450 + currentOffset, y: 250 + currentOffset }, 
      data: { label, nodeId: '', detalhes: '', tipo, cor },
    };
    
    nodeOffsetRef.current += 1;
    setNodes((nds) => nds.concat(newNode));
    setTimeout(() => centralizarNoPalcoUtil([newNode]), 50);
  };

  const onConnect = useCallback((params: any) => {
    if (!modoEdicao) return;
    const edge = { 
      ...params, label: '', animated: true, 
      style: { stroke: '#3b82f6' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
      data: { tipo: 'gravidade', diametro: '' }
    };
    setEdges((eds) => addEdge(edge, eds));
  }, [modoEdicao, setEdges]);

  // ==========================================
  // FUNÇÕES DE BACKUP / IMPORT / EXPORT
  // ==========================================
  
  const gerarTimestamp = () => {
    const agora = new Date();
    const dataFmt = agora.toLocaleDateString('pt-BR').replace(/\//g, '-');
    const horaFmt = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    return `${dataFmt}_${horaFmt}`;
  };

  const exportarSistema = (projeto: any) => {
    const dataStr = JSON.stringify(projeto, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projeto.nome.replace(/\s+/g, '_')}_${gerarTimestamp()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportarBackupGlobal = () => {
    const dataStr = JSON.stringify(projetos, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BACKUP_GLOBAL_DESO_${gerarTimestamp()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const restaurarBackupGlobal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    mostrarConfirmacao(
      "⚠️ AVISO DE SEGURANÇA CRÍTICO",
      "Você está prestes a restaurar um BACKUP GLOBAL. Isso irá APAGAR TODOS os sistemas atuais e substituí-los pelo conteúdo deste arquivo. Esta ação não pode ser desfeita. Deseja continuar?",
      () => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const importado = JSON.parse(event.target.result as string);
            if (Array.isArray(importado) && importado.length > 0) {
              setSyncStatus('syncing');
              
              if (supabaseConfigured) {
                const { error } = await supabase
                  .from('projetos')
                  .upsert(importado.map(p => ({
                    ...p,
                    updated_at: new Date().toISOString()
                  })));
                
                if (error) {
                  mostrarAviso("Erro na Nuvem", "Backup carregado localmente, mas houve erro ao sincronizar com a nuvem: " + error.message);
                  setSyncStatus('error');
                } else {
                  setSyncStatus('synced');
                }
              }

              setProjetos(importado);
              setProjetoAtivoId(importado[0].id);
              mostrarAviso("Sucesso", "Backup Global restaurado com sucesso!");
            } else {
              mostrarAviso("Erro", "Arquivo de Backup Global inválido.");
            }
          } catch (err) { 
            console.error('Erro ao restaurar backup:', err);
            mostrarAviso("Erro", "Erro ao processar o arquivo de backup."); 
          }
        };
        reader.readAsText(file);
      }
    );

    if (globalBackupRef.current) globalBackupRef.current.value = '';
  };

  const lidarComImportacaoIndividual = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importado = JSON.parse(event.target.result as string);
        if (importado.nodes && importado.edges) {
          const novo = { ...importado, id: generateUUID(), nome: `${importado.nome} (IMPORTADO)`, updated_at: new Date().toISOString() };
          setProjetos(prev => [...prev, novo]);
          setProjetoAtivoId(novo.id);
        } else { mostrarAviso("Erro", "Arquivo JSON inválido."); }
      } catch (err) { mostrarAviso("Erro", "Erro ao ler o arquivo."); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateBulkEdges = useCallback((changes: any) => {
    setEdges(eds => eds.map(e => {
      if (e.selected) {
        let newEdge = { ...e };
        if (changes.diametro !== undefined) {
          newEdge.data = { ...newEdge.data, diametro: changes.diametro };
          newEdge.label = changes.diametro ? `${changes.diametro} mm` : '';
        }
        if (changes.tipo !== undefined) {
          const color = changes.tipo === 'gravidade' ? '#3b82f6' : '#ef4444';
          newEdge.style = { ...newEdge.style, stroke: color };
          newEdge.markerEnd = { ...newEdge.markerEnd, color: color };
          newEdge.data = { ...newEdge.data, tipo: changes.tipo };
        }
        return newEdge;
      }
      return e;
    }));
  }, [setEdges]);

  const updateBulkNodes = useCallback((changes: any) => {
    setNodes(nds => nds.map(n => {
      if (n.selected) {
        let newNode = { ...n };
        if (changes.label !== undefined) {
          newNode.data = { ...newNode.data, label: changes.label };
        }
        if (changes.nodeId !== undefined) {
          newNode.data = { ...newNode.data, nodeId: changes.nodeId };
        }
        if (changes.detalhes !== undefined) {
          newNode.data = { ...newNode.data, detalhes: changes.detalhes };
        }
        return newNode;
      }
      return n;
    }));
  }, [setNodes]);

  const alinharHorizontal = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 2) return;
    
    // Alinhamento no eixo Y (média)
    const avgY = selectedNodes.reduce((acc, n) => acc + n.position.y, 0) / selectedNodes.length;
    
    // Distribuição no eixo X (equidistante com espaçamento mínimo)
    const sortedNodes = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
    const minX = sortedNodes[0].position.x;
    const maxX = sortedNodes[sortedNodes.length - 1].position.x;
    const count = sortedNodes.length;
    
    const HORIZONTAL_SPACING = 300; // Largura do nó (210) + margem
    let step = (maxX - minX) / (count - 1);
    
    // Se os nós estiverem muito próximos ou sobrepostos, força o espaçamento mínimo
    if (step < HORIZONTAL_SPACING) {
      step = HORIZONTAL_SPACING;
    }
    
    const newPositions = new Map();
    sortedNodes.forEach((n, i) => {
      newPositions.set(n.id, { x: minX + (i * step), y: avgY });
    });
    
    setNodes(nds => nds.map(n => {
      const pos = newPositions.get(n.id);
      return pos ? { ...n, position: pos } : n;
    }));
  }, [nodes, setNodes]);

  const alinharVertical = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 2) return;
    
    // Alinhamento no eixo X (média)
    const avgX = selectedNodes.reduce((acc, n) => acc + n.position.x, 0) / selectedNodes.length;
    
    // Distribuição no eixo Y (equidistante com espaçamento mínimo)
    const sortedNodes = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
    const minY = sortedNodes[0].position.y;
    const maxY = sortedNodes[sortedNodes.length - 1].position.y;
    const count = sortedNodes.length;
    
    const VERTICAL_SPACING = 100; // Altura aproximada do nó + margem
    let step = (maxY - minY) / (count - 1);
    
    // Se os nós estiverem muito próximos ou sobrepostos, força o espaçamento mínimo
    if (step < VERTICAL_SPACING) {
      step = VERTICAL_SPACING;
    }
    
    const newPositions = new Map();
    sortedNodes.forEach((n, i) => {
      newPositions.set(n.id, { x: avgX, y: minY + (i * step) });
    });
    
    setNodes(nds => nds.map(n => {
      const pos = newPositions.get(n.id);
      return pos ? { ...n, position: pos } : n;
    }));
  }, [nodes, setNodes]);

  const onNodeDragStart = useCallback(() => { isDragging.current = true; }, []);
  const onNodeDragStop = useCallback((_: any, node: any) => { 
    setTimeout(() => { isDragging.current = false; }, 100); 
    centralizarNoPalcoUtil([node]);
  }, [centralizarNoPalcoUtil]);

  const onNodeClick = useCallback((event: any, node: any) => {
    if (isDragging.current) return;
    
    // Se não estiver usando Shift, centraliza o nó e desmarca arestas manualmente para limpar o painel
    if (!event.shiftKey) {
      centralizarNoPalcoUtil([node]);
      setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
    }
    // A seleção em si é tratada pelo React Flow via onNodesChange + multiSelectionKeyCode
  }, [centralizarNoPalcoUtil, setEdges]);

  const onEdgeClick = useCallback((event: any, _edge: any) => {
    // Se não estiver usando Shift, desmarca nós manualmente
    if (!event.shiftKey) {
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    }
    // A seleção em si é tratada pelo React Flow via onEdgesChange + multiSelectionKeyCode
  }, [setNodes]);

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    // Se estiver segurando Shift, não limpa a seleção para permitir drag-box ou cliques múltiplos
    if (event.shiftKey) return;
    fecharPainel();
  }, [fecharPainel]);

  const sincronizarTudoComNuvem = async () => {
    if (!supabaseConfigured) {
      mostrarAviso("Atenção", "Supabase não configurado. Verifique os Secrets.");
      return;
    }

    mostrarConfirmacao(
      "Sincronização Global",
      "Deseja sincronizar TODOS os sistemas locais com a nuvem? Isso irá sobrescrever dados com o mesmo ID no Supabase.",
      async () => {
        setSyncStatus('syncing');
        addDebugLog('Iniciando sincronização manual de todos os projetos...');
        
        try {
          const { error, data, status } = await supabase
            .from('projetos')
            .upsert(projetos.map(p => ({
              ...p,
              updated_at: new Date().toISOString()
            })), { onConflict: 'id' })
            .select();

          if (error) {
            addDebugLog(`Erro na sincronização manual: ${error.message}`);
            throw error;
          }
          
          addDebugLog(`Sincronização manual concluída. Status: ${status}. Itens: ${data?.length || 0}`);
          setSyncStatus('synced');
          setSupabaseError(null);
          mostrarAviso("Sucesso", "Sincronização completa! Todos os sistemas foram enviados para a nuvem.");
        } catch (err: any) {
          addDebugLog(`Erro na sincronização manual: ${err.message}`);
          setSyncStatus('error');
          setSupabaseError(`Erro na sincronização: ${err.message}`);
          mostrarAviso("Erro", "Erro ao sincronizar: " + err.message);
        }
      }
    );
  };

  const criarNovoProjeto = async () => {
    if (!nomeNovoProjeto.trim()) {
      setErroModal("O nome do projeto não pode estar vazio.");
      return;
    }
    
    const nomeNormalizado = nomeNovoProjeto.trim().toUpperCase();
    
    // Verifica se o nome já existe
    const existe = projetos.some(p => p.nome.toUpperCase() === nomeNormalizado);
    if (existe) {
      setErroModal("Já existe um sistema com este nome.");
      return;
    }

    const novo = { 
      id: generateUUID(),
      nome: nomeNormalizado, 
      nodes: [], 
      edges: [],
      updated_at: new Date().toISOString()
    };
    
    try {
      if (supabaseConfigured) {
        const { data, error } = await supabase.from('projetos').insert([novo]).select();
        if (error) throw error;
        if (data && data.length > 0) {
          setProjetos(prev => [...prev, data[0]]);
          setProjetoAtivoId(data[0].id);
          addDebugLog(`Novo projeto criado: ${data[0].nome}`);
        }
      } else {
        setProjetos(prev => [...prev, novo]);
        setProjetoAtivoId(novo.id);
        addDebugLog(`Novo projeto local criado`);
      }
      setShowModalNovo(false);
      setNomeNovoProjeto('');
      setErroModal('');
    } catch (err: any) {
      addDebugLog(`ERRO ao criar projeto: ${err.message}`);
      setErroModal(`Erro ao criar projeto: ${err.message}`);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden', flexDirection: isMobileView ? 'column' : 'row' }}>
      <style>{globalStyles}</style>

      {/* SIDEBAR ESQUERDA - Oculta no Mobile ou exibida como Overlay */}
      {(!isMobileView || showMobileMenu) && (
        <div 
          className={isMobileView ? "fade-in" : ""}
          style={{ 
            width: isMobileView ? '100%' : '280px', 
            height: '100%',
            position: isMobileView ? 'fixed' : 'relative',
            top: 0, left: 0,
            background: isMobileView ? 'rgba(15, 23, 42, 0.4)' : '#ffffff', 
            backdropFilter: isMobileView ? 'blur(4px)' : 'none',
            display: 'flex', 
            flexDirection: 'column', 
            zIndex: 2000 
          }}
          onClick={() => isMobileView && setShowMobileMenu(false)}
        >
          <div 
            style={{ 
              width: isMobileView ? '85%' : '100%',
              height: '100%',
              background: 'white',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: isMobileView ? '20px 0 50px rgba(0,0,0,0.2)' : 'none',
              borderRight: isMobileView ? 'none' : '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER DA SIDEBAR */}
            <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#2563eb', padding: '10px', borderRadius: '12px' }}><Droplet size={22} color="white" fill="white"/></div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <h2 style={{ fontSize: '12px', fontWeight: 800, color: '#1e3a8a', lineHeight: 1.2, textTransform: 'uppercase' }}>
                    Sistemas <span style={{ color: '#3b82f6' }}>DESO</span>
                  </h2>
                  <div style={versionBadgeStyle}>BUILD {DEV_VERSION}</div>
                </div>
              </div>
              {isMobileView && (
                <button onClick={() => setShowMobileMenu(false)} style={btnClose}><X size={24} /></button>
              )}
            </div>

            {isMobileView && (
              <div style={{ padding: '12px 24px', background: '#fff1f2', borderBottom: '1px solid #fecdd3' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Ban size={12} /> Modo Somente Leitura Ativo
                </div>
              </div>
            )}
            
            {/* BOTÕES DE TOPO - Desabilitados no Mobile */}
            {!isMobileView && (
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button 
                  disabled={!modoEdicao}
                  onClick={() => {
                    if (!modoEdicao) return;
                    setErroModal('');
                    setNomeNovoProjeto('');
                    setShowModalNovo(true);
                  }} 
                  style={{ 
                    ...btnNovoProjeto, 
                    opacity: modoEdicao ? 1 : 0.5, 
                    cursor: modoEdicao ? 'pointer' : 'not-allowed',
                    filter: modoEdicao ? 'none' : 'grayscale(0.5)'
                  }}
                >
                  <Plus size={14} /> + Novo Projeto
                </button>
                
                <button onClick={() => fileInputRef.current?.click()} style={btnImportar}>
                  <Upload size={14} /> Importar Arquivo JSON
                </button>
                <input type="file" ref={fileInputRef} onChange={lidarComImportacaoIndividual} accept=".json" style={{ display: 'none' }} />
              </div>
            )}

            {/* LISTA DE SISTEMAS (SCROLLABLE) */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={labelSmall}>Sistemas Disponíveis</p>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>{projetosFiltrados.length}</span>
              </div>

              {/* OPÇÕES DE ORDENAÇÃO */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                <button 
                  onClick={() => setOrdenacao('data')}
                  style={{
                    ...btnMiniSort,
                    background: ordenacao === 'data' ? '#eff6ff' : '#f8fafc',
                    color: ordenacao === 'data' ? '#2563eb' : '#64748b',
                    borderColor: ordenacao === 'data' ? '#dbeafe' : '#e2e8f0',
                    padding: '8px'
                  }}
                >
                  <Clock size={12} style={{marginRight: '6px'}}/> Recentes
                </button>
                <button 
                  onClick={() => setOrdenacao('nome')}
                  style={{
                    ...btnMiniSort,
                    background: ordenacao === 'nome' ? '#eff6ff' : '#f8fafc',
                    color: ordenacao === 'nome' ? '#2563eb' : '#64748b',
                    borderColor: ordenacao === 'nome' ? '#dbeafe' : '#e2e8f0',
                    padding: '8px'
                  }}
                >
                  <Activity size={12} style={{marginRight: '6px'}}/> A-Z
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {projetosFiltrados.map(p => (
                  <div key={p.id} onClick={() => {
                    if (projetoAtivoId !== p.id) {
                      const currentNodes = nodesRef.current;
                      const currentEdges = edgesRef.current;
                      setProjetos(prev => prev.map(proj => proj.id === projetoAtivoId ? { ...proj, nodes: currentNodes, edges: currentEdges } : proj));
                      setProjetoAtivoId(p.id);
                      if (isMobileView) setShowMobileMenu(false);
                    }
                  }} 
                    style={{ 
                      ...itemProjeto, 
                      padding: isMobileView ? '14px' : '10px',
                      background: projetoAtivoId === p.id ? '#eff6ff' : 'transparent', 
                      borderColor: projetoAtivoId === p.id ? '#dbeafe' : 'transparent' 
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', flex: 1 }}>
                      <FileText size={18} color={projetoAtivoId === p.id ? '#3b82f6' : '#94a3b8'} />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: projetoAtivoId === p.id ? '#1e40af' : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</span>
                    </div>
                    {!isMobileView && (
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button onClick={(e) => { e.stopPropagation(); exportarSistema(p); }} style={btnMini} title="Exportar individual"><Download size={12} /></button>
                        <button onClick={(e) => { 
                          e.stopPropagation(); 
                          if (!modoEdicao) return;
                          const pCopia = { ...p, id: generateUUID(), nome: `${p.nome} (CÓPIA)`, updated_at: new Date().toISOString() };
                          
                          if (supabaseConfigured) {
                            supabase.from('projetos').insert([pCopia]).select().then(({data, error}) => {
                              if (error) {
                                mostrarAviso("Erro ao Copiar", `Erro ao copiar: ${error.message}`);
                                return;
                              }
                              if (data) {
                                setProjetos([...projetos, data[0]]);
                                setProjetoAtivoId(data[0].id);
                              }
                            });
                          } else {
                            setProjetos([...projetos, pCopia]);
                            setProjetoAtivoId(pCopia.id);
                          }
                        }} 
                        style={{ 
                          ...btnMini, 
                          opacity: modoEdicao ? 1 : 0.4, 
                          cursor: modoEdicao ? 'pointer' : 'not-allowed' 
                        }} 
                        title={modoEdicao ? "Copiar" : "Modo Edição necessário para copiar"}
                      >
                        <Copy size={12} />
                      </button>
                        <button onClick={(e) => { 
                          e.stopPropagation(); 
                          if (projetos.length > 1) { 
                            mostrarConfirmacao(
                              "Excluir Sistema",
                              `Deseja realmente excluir o sistema "${p.nome}"? Esta ação não pode ser desfeita.`,
                              () => {
                                if (supabaseConfigured) {
                                  supabase.from('projetos').delete().eq('id', p.id).then(({ error }) => {
                                    if (error) {
                                      mostrarAviso("Erro ao Excluir", `Erro ao excluir na nuvem: ${error.message}`);
                                      return;
                                    }
                                    setProjetos(prev => {
                                      const novos = prev.filter(x => x.id !== p.id); 
                                      if (projetoAtivoId === p.id) setProjetoAtivoId(novos[0].id);
                                      return novos;
                                    });
                                    addDebugLog(`Projeto excluído: ${p.nome}`);
                                  });
                                } else {
                                  setProjetos(prev => {
                                    const novos = prev.filter(x => x.id !== p.id); 
                                    if (projetoAtivoId === p.id) setProjetoAtivoId(novos[0].id);
                                    return novos;
                                  });
                                  addDebugLog(`Projeto local excluído: ${p.nome}`);
                                }
                              }
                            );
                          } else {
                            mostrarAviso("Atenção", "Não é possível excluir o último sistema. É necessário ter ao menos um sistema ativo.");
                          }
                        }} style={{ ...btnMini, color: '#ef4444' }} title="Apagar"><Trash2 size={12} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* BOTÕES DE BACKUP GLOBAL - Ocultos no Mobile */}
            {!isMobileView && (
              <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
                <p style={{...labelSmall, marginBottom: '10px'}}>Manutenção de Banco</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button onClick={() => exportarBackupGlobal()} style={btnBackupOp} title="Backup Geral">
                      <Database size={13} /> Backup Total
                    </button>
                    <button onClick={() => globalBackupRef.current?.click()} style={{...btnBackupOp, borderColor: '#fecdd3'}} title="Restaurar Tudo">
                      <ShieldAlert size={13} color="#ef4444" /> Restaurar
                    </button>
                  </div>
                  {supabaseConfigured && (
                    <button onClick={sincronizarTudoComNuvem} style={{...btnBackupOp, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534'}} title="Sincronizar tudo com a nuvem">
                      <RefreshCw size={13} color="#16a34a" /> Sincronizar com Nuvem
                    </button>
                  )}
                </div>
                <input type="file" ref={globalBackupRef} onChange={restaurarBackupGlobal} accept=".json" style={{ display: 'none' }} />
              </div>
            )}

            {/* CONSOLE DE DEPURAÇÃO - Oculto no Mobile */}
            {!isMobileView && (
              <div style={{ padding: '12px', borderTop: '1px solid #f1f5f9', background: '#1e293b', color: '#94a3b8', fontSize: '9px', fontFamily: 'monospace', maxHeight: '150px', overflowY: 'auto' }}>
                <p style={{ color: '#3b82f6', fontWeight: 800, marginBottom: '5px', fontSize: '10px' }}>LOG DE SINCRONIZAÇÃO</p>
                {debugLogs.length === 0 ? (
                  <p>Nenhuma atividade registrada.</p>
                ) : (
                  debugLogs.map((log, i) => <p key={i} style={{ marginBottom: '2px' }}>{log}</p>)
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <div style={{ 
          ...headerStyle, 
          height: isMobileView ? (isLandscape ? '56px' : '72px') : '80px', 
          padding: isMobileView ? '0 16px' : '0 30px', 
          flexDirection: 'row', 
          gap: '12px',
          justifyContent: 'space-between',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
        }}>
          {/* LADO ESQUERDO: BOTÃO DE MODO E PESQUISA GERAL */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: isLandscape ? '0 0 auto' : 1 }}>
            {isMobileView ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  onClick={() => setShowMobileMenu(true)} 
                  style={{ 
                    ...btnSecundario, 
                    padding: '10px', 
                    borderRadius: '12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <Layers size={22} color="#1e293b" />
                </button>
                <div style={{ 
                  fontSize: '9px', 
                  fontWeight: 900, 
                  color: '#3b82f6', 
                  background: '#eff6ff', 
                  padding: '2px 8px', 
                  borderRadius: '6px', 
                  textTransform: 'uppercase', 
                  border: '1px solid #dbeafe',
                  letterSpacing: '0.5px'
                }}>
                  Consulta
                </div>
              </div>
            ) : (
              <button onClick={() => { 
                if (!modoEdicao) {
                  const isMobile = window.innerWidth <= 768;
                  if (isMobile) {
                    mostrarAviso("Dispositivo Móvel", "O Modo Edição não está disponível em dispositivos móveis para garantir a precisão do fluxograma.");
                    return;
                  }
                }
                if (modoEdicao) {
                  salvarNoSupabase();
                }
                setModoEdicao(!modoEdicao); 
                fecharPainel(); 
              }} style={{ ...btnPrimario, background: modoEdicao ? '#ef4444' : '#2563eb', whiteSpace: 'nowrap' }}>
                {modoEdicao ? 'Salvar Sistema' : 'Modo Edição'}
              </button>
            )}

            {!isMobileView && (
              <div className="search-input-container" style={{ width: '250px' }}>
                <Activity size={14} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Pesquisa Geral..." 
                  value={termoPesquisaProjetos}
                  onChange={(e) => setTermoPesquisaProjetos(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* CENTRO: TÍTULO DO PROJETO */}
          <div style={{ 
            flex: 3, 
            textAlign: 'center', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center',
            overflow: 'hidden',
            padding: '0 5px'
          }}>
            {modoEdicao ? (
              <input value={projetoAtivo?.nome || ''} 
                onChange={(e) => setProjetos(projetos.map(p => p.id === projetoAtivoId ? {...p, nome: e.target.value.toUpperCase()} : p))} 
                style={{ ...inputHeader, textAlign: 'center', width: '100%', maxWidth: '400px' }} />
            ) : (
              <h1 style={{ 
                fontSize: isMobileView ? '18px' : '20px', 
                fontWeight: 900, 
                color: '#1e293b', 
                textTransform: 'uppercase', 
                letterSpacing: '0.8px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                width: '100%'
              }}>
                {projetoAtivo?.nome}
              </h1>
            )}
          </div>

          {/* LADO DIREITO: BOTÕES DE VISÃO/PDF E STATUS */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: isLandscape ? '0 0 auto' : 1, justifyContent: 'flex-end' }}>
            {isMobileView && (
              <button 
                onClick={exportarPDF} 
                style={{ 
                  ...btnSecundario, 
                  padding: '10px', 
                  borderRadius: '12px',
                  background: '#f0f9ff',
                  borderColor: '#bae6fd',
                  color: '#0369a1',
                  minWidth: '44px'
                }}
                title="Exportar PDF"
              >
                <Printer size={20} />
              </button>
            )}

            <button 
              onClick={() => fitView({ duration: 800, padding: 0.4 })} 
              style={{ 
                ...btnSecundario, 
                padding: isMobileView ? '10px' : '10px 20px', 
                borderRadius: '12px',
                minWidth: isMobileView ? '44px' : 'auto'
              }}
            >
              {isMobileView ? <Zap size={20} /> : 'Visão Geral'}
            </button>
            
            {!isMobileView && (
              <button onClick={exportarPDF} style={{...btnSecundario, borderColor: '#3b82f6', color: '#3b82f6', whiteSpace: 'nowrap'}}>
                <FileDown size={14} style={{marginRight: '5px'}}/> Exportar PDF
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {syncStatus === 'syncing' && <RefreshCw size={14} className="animate-spin" color="#3b82f6" />}
              {syncStatus === 'synced' && <Cloud size={14} color="#10b981" />}
              {syncStatus === 'error' && <CloudOff size={14} color="#ef4444" />}
              {!isMobileView && (
                <span style={{ fontSize: '10px', fontWeight: 700, color: syncStatus === 'error' ? '#ef4444' : '#64748b' }}>
                  {syncStatus === 'syncing' ? 'Sincronizando...' : syncStatus === 'synced' ? 'Nuvem OK' : 'Erro'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ flexGrow: 1, position: 'relative' }}>
            <ReactFlow
              nodes={nodes} edges={edges} nodeTypes={nodeTypes}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
              onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} onSelectionChange={onSelectionChange} onSelectionEnd={onSelectionEnd}
              onNodeDragStart={onNodeDragStart} onNodeDragStop={onNodeDragStop}
              onPaneClick={onPaneClick}
            nodesDraggable={modoEdicao} nodesConnectable={modoEdicao}
            snapToGrid={modoEdicao} snapGrid={[20, 20]}
            deleteKeyCode={modoEdicao ? ["Backspace", "Delete"] : null}
            selectionMode={SelectionMode.Partial} selectNodesOnDrag={modoEdicao}
            connectionMode={ConnectionMode.Loose}
            multiSelectionKeyCode="Shift"
            selectionKeyCode="Shift"
            panOnScroll={isMobileView}
            zoomOnPinch={true}
            preventScrolling={true}
          >
            <Background color="#cbd5e1" variant={BackgroundVariant.Dots} gap={20} />
            {/* Controls removidos conforme solicitação do usuário */}

            {/* PESQUISA NO FLUXOGRAMA (LOCAL) */}
            <Panel position="top-left" style={{ marginTop: '16px', marginLeft: '16px' }}>
              <div className="search-input-container" style={{ width: isMobileView ? '180px' : '220px' }}>
                <Zap size={14} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Pesquisar nó..." 
                  value={termoPesquisaElementos}
                  onChange={(e) => setTermoPesquisaElementos(e.target.value)}
                  style={{ background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: 'none' }}
                />
              </div>
            </Panel>

            {modoEdicao && totalSelecionado >= 1 && (
              <Panel position="bottom-center" style={{ marginBottom: '20px' }}>
                <button onClick={excluirSelecaoTotal} style={btnExclusaoBulk}>
                  <Trash2 size={16} /> Excluir Seleção ({totalSelecionado})
                </button>
              </Panel>
            )}

            {modoEdicao && (
              <Panel position="top-right" style={{ marginTop: '20px', marginRight: '20px' }}>
                <div style={panelComponents}>
                  <p style={labelSmall}>Componentes</p>
                  <button onClick={() => adicionarNo('Captação', 'Captação', '#3b82f6')} style={btnComp}><Waves size={14}/> Captação</button>
                  <button onClick={() => adicionarNo('Tratamento', 'Tratamento', '#f59e0b')} style={btnComp}><Beaker size={14}/> Tratamento</button>
                  <button onClick={() => adicionarNo('Armazenamento', 'Reservatório', '#8b5cf6')} style={btnComp}><Droplets size={14}/> Reservatório</button>
                  <button onClick={() => adicionarNo('Macromedidor', 'Macromedidor', '#10b981')} style={btnComp}><Gauge size={14}/> Macromedidor</button>
                  <button onClick={() => adicionarNo('Iguá', 'Iguá', '#1e40af')} style={btnComp}><Droplet size={14}/> Iguá</button>
                  <button onClick={() => adicionarNo('Descarte', 'Descarte', '#ef4444')} style={btnComp}><Ban size={14}/> Descarte</button>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>

      {/* PAINEL DIREITO */}
      {selecionado && (
        <div 
          className={isMobileView && !isLandscape ? "bottom-sheet-enter" : "fade-in"}
          style={{
            ...sidePanel,
            width: isMobileView ? (isLandscape ? '280px' : '100%') : '300px',
            height: isMobileView && !isLandscape ? '65vh' : 'auto',
            top: isMobileView ? (isLandscape ? '66px' : 'auto') : '96px',
            bottom: isMobileView ? (isLandscape ? '10px' : '0') : '16px',
            right: isMobileView ? (isLandscape ? '10px' : '0') : '16px',
            left: isMobileView && !isLandscape ? '0' : 'auto',
            borderRadius: isMobileView && !isLandscape ? '24px 24px 0 0' : '20px',
            padding: isMobileView ? '24px' : '28px',
            boxShadow: isMobileView ? '0 -15px 40px rgba(0,0,0,0.15)' : '0 0 30px rgba(0,0,0,0.08)',
            overflowY: 'auto'
          }}
        >
          {/* DRAG HANDLE PARA MOBILE */}
          {isMobileView && !isLandscape && (
            <div style={{ width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '10px', margin: '-12px auto 16px auto' }} />
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: isMobileView ? '14px' : '16px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {selecionado.type === 'bulk' ? `Edição em Massa` : 'Configurações'}
            </h3>
            <button onClick={fecharPainel} style={btnClose}><X size={20} /></button>
          </div>
          
          {selecionado.type === 'bulk' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                  <Layers size={12} style={{verticalAlign:'middle', marginRight: '5px'}}/> 
                  {selecionado.nodeCount} nós e {selecionado.edgeCount} linhas
                </p>
              </div>

              {selecionado.nodeCount > 1 && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label style={labelSmall}>Identificação em Massa</label>
                    <input type="text" style={inputStyle} placeholder="Alterar todos os nomes para..." disabled={!modoEdicao} onChange={(e) => updateBulkNodes({ label: e.target.value })} />
                  </div>
                  
                  <div>
                    <label style={labelSmall}>Código do Ativo em Massa</label>
                    <input type="text" style={inputStyle} placeholder="Alterar todos os códigos para..." disabled={!modoEdicao} onChange={(e) => updateBulkNodes({ nodeId: e.target.value })} />
                  </div>

                  <div>
                    <label style={labelSmall}>Detalhes em Massa</label>
                    <textarea style={{ ...inputStyle, height: '80px', resize: 'none', padding: '10px' }} placeholder="Alterar todos os detalhes para..." disabled={!modoEdicao} onChange={(e) => updateBulkNodes({ detalhes: e.target.value })} />
                  </div>
                  
                  <div>
                    <label style={labelSmall}>Ferramentas de Alinhamento</label>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button onClick={alinharHorizontal} disabled={!modoEdicao} style={{ ...btnBackupOp, flex: 1, background: '#f8fafc' }}>
                        <ArrowDown size={14} style={{transform: 'rotate(90deg)'}}/> Alinhar Horizontal
                      </button>
                      <button onClick={alinharVertical} disabled={!modoEdicao} style={{ ...btnBackupOp, flex: 1, background: '#f8fafc' }}>
                        <ArrowDown size={14}/> Alinhar Vertical
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {selecionado.edgeCount > 0 && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '15px' }}>
                  <label style={labelSmall}>Diâmetro p/ Tubulações (mm)</label>
                  <input type="number" style={inputStyle} placeholder="Alterar todas para..." disabled={!modoEdicao} onChange={(e) => updateBulkEdges({ diametro: e.target.value })} />
                  <label style={{...labelSmall, marginTop: '15px'}}>Tipo de Fluxo em Massa</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => updateBulkEdges({ tipo: 'gravidade' })} disabled={!modoEdicao} style={{ ...btnFlowType, background: '#3b82f6', color: 'white' }}>Gravidade</button>
                    <button onClick={() => updateBulkEdges({ tipo: 'bombeada' })} disabled={!modoEdicao} style={{ ...btnFlowType, background: '#ef4444', color: 'white' }}>Bombeada</button>
                  </div>
                </div>
              )}

              {modoEdicao && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '15px', marginTop: 'auto' }}>
                  <button onClick={excluirSelecaoTotal} style={btnDeleteSide}>
                    <Trash2 size={14} /> Excluir Seleção ({totalSelecionado})
                  </button>
                </div>
              )}
            </div>
          ) : selecionado.type === 'node' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={labelSmall}>Identificação</label>
                <input style={inputStyle} value={selecionado.data.label} disabled={!modoEdicao} onChange={(e) => {
                  const val = e.target.value;
                  setNodes(nds => nds.map(n => n.id === selecionado.id ? { ...n, data: { ...n.data, label: val } } : n));
                }} />
              </div>
              <div>
                <label style={labelSmall}>Código do Ativo</label>
                <input style={inputStyle} value={selecionado.data.nodeId} disabled={!modoEdicao} placeholder="Ex: CAP-01" onChange={(e) => {
                  const val = e.target.value;
                  setNodes(nds => nds.map(n => n.id === selecionado.id ? { ...n, data: { ...n.data, nodeId: val } } : n));
                }} />
              </div>
              {selecionado.data.tipo === 'Tratamento' && (
                <>
                  <div>
                    <label style={labelSmall}>Concessionária</label>
                    <input style={inputStyle} value={selecionado.data.concessionaria || ''} disabled={!modoEdicao} placeholder="Ex: ENERGISA" onChange={(e) => {
                      const val = e.target.value;
                      setNodes(nds => nds.map(n => n.id === selecionado.id ? { ...n, data: { ...n.data, concessionaria: val } } : n));
                    }} />
                  </div>
                  <div>
                    <label style={labelSmall}>UC</label>
                    <input style={inputStyle} value={selecionado.data.uc || ''} disabled={!modoEdicao} placeholder="Ex: 123456" onChange={(e) => {
                      const val = e.target.value;
                      setNodes(nds => nds.map(n => n.id === selecionado.id ? { ...n, data: { ...n.data, uc: val } } : n));
                    }} />
                  </div>
                  <div>
                    <label style={labelSmall}>Medidor</label>
                    <input style={inputStyle} value={selecionado.data.medidor || ''} disabled={!modoEdicao} placeholder="Ex: ABC-789" onChange={(e) => {
                      const val = e.target.value;
                      setNodes(nds => nds.map(n => n.id === selecionado.id ? { ...n, data: { ...n.data, medidor: val } } : n));
                    }} />
                  </div>
                </>
              )}
              <div>
                <label style={labelSmall}>Detalhes</label>
                <textarea style={{ ...inputStyle, height: '120px', resize: 'none', padding: '10px' }} value={selecionado.data.detalhes || ''} disabled={!modoEdicao} placeholder="Informações adicionais do nó..." onChange={(e) => {
                    const val = e.target.value;
                    setNodes(nds => nds.map(n => n.id === selecionado.id ? { ...n, data: { ...n.data, detalhes: val } } : n));
                }} />
              </div>
              {modoEdicao && <button onClick={excluirSelecaoTotal} style={btnDeleteSide}><Trash2 size={14} /> Excluir Item</button>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#64748b' }}>
                <MoveRight size={16}/> <span style={{fontSize: '11px', fontWeight: 700}}>TUBULAÇÃO</span>
              </div>
              <div>
                <label style={labelSmall}>Diâmetro (mm)</label>
                <input type="number" style={inputStyle} value={selecionado.data.diametro || ''} disabled={!modoEdicao} placeholder="Ex: 150" onChange={(e) => {
                    const val = e.target.value;
                    setEdges(eds => eds.map(edge => {
                      if (edge.id === selecionado.id) {
                        return { ...edge, label: val ? `${val} mm` : '', data: { ...edge.data, diametro: val } };
                      }
                      return edge;
                    }));
                }} />
              </div>
              <div>
                <label style={labelSmall}>Tipo de Fluxo</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => {
                      setEdges(eds => eds.map(edge => {
                        if (edge.id === selecionado.id) {
                          return { ...edge, style: { stroke: '#3b82f6' }, markerEnd: { ...edge.markerEnd, color: '#3b82f6' }, data: { ...edge.data, tipo: 'gravidade' } };
                        }
                        return edge;
                      }));
                    }} disabled={!modoEdicao} style={{ ...btnFlowType, background: selecionado.data.tipo === 'gravidade' ? '#3b82f6' : '#f1f5f9', color: selecionado.data.tipo === 'gravidade' ? 'white' : '#64748b' }}
                  >Gravidade</button>
                  <button onClick={() => {
                      setEdges(eds => eds.map(edge => {
                        if (edge.id === selecionado.id) {
                          return { ...edge, style: { stroke: '#ef4444' }, markerEnd: { ...edge.markerEnd, color: '#ef4444' }, data: { ...edge.data, tipo: 'bombeada' } };
                        }
                        return edge;
                      }));
                    }} disabled={!modoEdicao} style={{ ...btnFlowType, background: selecionado.data.tipo === 'bombeada' ? '#ef4444' : '#f1f5f9', color: selecionado.data.tipo === 'bombeada' ? 'white' : '#64748b' }}
                  >Bombeada</button>
                </div>
              </div>
              {modoEdicao && <button onClick={excluirSelecaoTotal} style={btnDeleteSide}><Trash2 size={14} /> Excluir Conexão</button>}
            </div>
          )}
        </div>
      )}

      {/* MODAL NOVO PROJETO */}
      {showModalNovo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
        }}>
          <div style={{
            background: 'white', padding: '32px', borderRadius: '20px', width: '400px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>Novo Sistema</h3>
              <button onClick={() => setShowModalNovo(false)} style={btnClose}><X size={20} /></button>
            </div>
            
            <div>
              <label style={labelSmall}>Nome do Sistema</label>
              <input 
                autoFocus
                style={{...inputStyle, background: 'white', border: erroModal ? '1px solid #ef4444' : '1px solid #e2e8f0'}} 
                placeholder="Ex: SISTEMA DE ABASTECIMENTO X"
                value={nomeNovoProjeto}
                onChange={(e) => {
                  setNomeNovoProjeto(e.target.value);
                  if (erroModal) setErroModal('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && criarNovoProjeto()}
              />
              {erroModal && <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '6px', fontWeight: 600 }}>{erroModal}</p>}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button onClick={() => setShowModalNovo(false)} style={{...btnSecundario, flex: 1}}>Cancelar</button>
              <button onClick={criarNovoProjeto} style={{...btnPrimario, flex: 1, background: '#2563eb'}}>Criar Sistema</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL GERAL (AVISO / CONFIRMAÇÃO) */}
      {modalConfig.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
        }}>
          <div style={{
            background: 'white', padding: '32px', borderRadius: '20px', width: '450px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {modalConfig.tipo === 'confirmacao' ? <ShieldAlert size={22} color="#f59e0b" /> : <Activity size={22} color="#3b82f6" />}
                {modalConfig.titulo}
              </h3>
              <button onClick={fecharModalGeral} style={btnClose}><X size={20} /></button>
            </div>
            
            <div style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, fontWeight: 500 }}>
              {modalConfig.mensagem}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              {modalConfig.tipo === 'confirmacao' ? (
                <>
                  <button onClick={fecharModalGeral} style={{...btnSecundario, flex: 1}}>Cancelar</button>
                  <button onClick={() => { modalConfig.onConfirm?.(); fecharModalGeral(); }} style={{...btnPrimario, flex: 1, background: '#ef4444'}}>Confirmar</button>
                </>
              ) : (
                <button onClick={fecharModalGeral} style={{...btnPrimario, flex: 1, background: '#2563eb'}}>Entendido</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// ESTILOS
// ==========================================
const versionBadgeStyle = { fontSize: '9px', fontWeight: 800, color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', width: 'fit-content', marginTop: '4px' };
const btnNovoProjeto = { width: '100%', padding: '12px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const btnImportar = { width: '100%', padding: '10px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const btnBackupOp = { flex: 1, padding: '10px', background: '#ffffff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s' };
const itemProjeto = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 10px', borderRadius: '10px', cursor: 'pointer', marginBottom: '4px', border: '1px solid transparent', transition: 'all 0.2s', overflow: 'hidden' };
const btnMiniSort = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 4px', fontSize: '9px', fontWeight: 700, borderRadius: '6px', border: '1px solid transparent', cursor: 'pointer', transition: 'all 0.2s' };
const btnMini = { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' };
const headerStyle = { height: '80px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 30px', zIndex: 5 };
const inputHeader = { fontSize: '16px', fontWeight: 700, color: '#1e3a8a', border: 'none', borderBottom: '2px solid #3b82f6', outline: 'none', background: 'transparent', width: '100%', maxWidth: '400px' };
const btnPrimario = { padding: '10px 20px', borderRadius: '10px', border: 'none', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' };
const btnSecundario = { padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: 600, fontSize: '13px', cursor: 'pointer' };
const panelComponents = { background: 'white', padding: '15px', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '180px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' };
const btnComp = { padding: '10px', border: '1px solid #f1f5f9', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 500, textAlign: 'left' as const, color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' };
const sidePanel = { position: 'fixed' as const, right: 16, top: 96, bottom: 16, width: '300px', background: 'white', padding: '28px', borderRadius: '18px', boxShadow: '0 0 30px rgba(0,0,0,0.08)', zIndex: 100, display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#f8fafc', outline: 'none' };
const labelSmall = { fontSize: '10px', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' };
const btnClose = { background: '#f8fafc', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#94a3b8' };
const btnDeleteSide = { marginTop: 'auto', padding: '12px', background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const btnExclusaoBulk = { padding: '12px 24px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.3)' };
const btnFlowType = { flex: 1, padding: '10px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' };

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowContent />
    </ReactFlowProvider>
  );
}
