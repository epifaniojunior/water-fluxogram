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
  FileText, Copy, Droplet, Trash2, Plus, Zap, ArrowDown, MoveRight, Layers, Download, Upload, Clock, Database, ShieldAlert, Cloud, CloudOff, RefreshCw
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';

// ==========================================
// CONFIGURAÇÃO DE VERSÃO DE DESENVOLVIMENTO
// ==========================================
const DEV_VERSION = 'v1.4.1'; 
const STORAGE_KEY = 'fluxo_agua_v81_deso';

const globalStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; color: #1e293b; background: #f8fafc; }
  .react-flow__edge-path { stroke-linecap: round; transition: stroke 0.3s, stroke-width 0.3s; stroke-width: 4; }
  .react-flow__edge.selected .react-flow__edge-path { stroke-width: 6; stroke: #1e293b !important; }
  .react-flow__edge-text { fill: #1e293b; font-size: 13px; font-weight: 800; pointer-events: none; }
  .react-flow__edge-textbg { fill: #ffffff; fill-opacity: 0.9; rx: 6; ry: 6; }
  .react-flow__handle { width: 8px !important; height: 8px !important; background: #cbd5e1 !important; border: 2px solid white !important; }
  .react-flow__selection { background: rgba(37, 99, 235, 0.1); border: 1px solid #2563eb; }
  @keyframes glowPulse {
    0% { box-shadow: 0 0 0 0px rgba(59, 130, 246, 0.4); }
    70% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
    100% { box-shadow: 0 0 0 0px rgba(59, 130, 246, 0); }
  }
  .node-selected-pulse { animation: glowPulse 2s infinite; border-color: #3b82f6 !important; }
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
  return (
    <div className={selected ? 'node-selected-pulse' : ''} style={{ 
      background: '#fff', borderRadius: '14px', border: selected ? `2px solid ${data.cor}` : '1px solid #e2e8f0',
      width: '210px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
    }}>
      <div style={{ background: data.cor, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', color: 'white' }}>
        {icons[data.tipo] || <Activity size={14} />}
        <div style={{ fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>{data.label}</div>
      </div>
      <div style={{ padding: '12px', background: 'white', textAlign: 'center', borderTop: '1px solid #f1f5f9', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>{data.nodeId || ""}</div>
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
  const [selecionado, setSelecionado] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [supabaseConfigured] = useState(() => isSupabaseConfigured());
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

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
  const { setCenter, fitView, deleteElements, fitBounds, getViewport } = useReactFlow();

  const nodesSelecionados = useMemo(() => nodes.filter(n => n.selected), [nodes]);
  const edgesSelecionadas = useMemo(() => edges.filter(e => e.selected), [edges]);
  const totalSelecionado = nodesSelecionados.length + edgesSelecionadas.length;

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
    if (params.nodes.length > 0) centralizarNoPalcoUtil(params.nodes);
  }, [centralizarNoPalcoUtil]);

  useEffect(() => {
    if (totalSelecionado > 1) {
      setSelecionado({ type: 'bulk', count: totalSelecionado, nodeCount: nodesSelecionados.length, edgeCount: edgesSelecionadas.length });
    } else if (totalSelecionado === 0) {
      setSelecionado(null);
    } else if (nodesSelecionados.length === 1) {
      setSelecionado({ type: 'node', id: nodesSelecionados[0].id, data: nodesSelecionados[0].data });
    } else if (edgesSelecionadas.length === 1) {
      setSelecionado({ type: 'edge', id: edgesSelecionadas[0].id, data: edgesSelecionadas[0].data });
    }
  }, [totalSelecionado, nodesSelecionados, edgesSelecionadas]);

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

  const fecharPainel = useCallback(() => {
    setSelecionado(null);
    setNodes(nds => nds.map(n => ({ ...n, selected: false })));
    setEdges(eds => eds.map(e => ({ ...e, selected: false })));
  }, [setNodes, setEdges]);

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

    const confirmar = window.confirm(
      "⚠️ AVISO DE SEGURANÇA CRÍTICO ⚠️\n\nVocê está prestes a restaurar um BACKUP GLOBAL. " +
      "Isso irá APAGAR TODOS os sistemas atuais e substituí-los pelo conteúdo deste arquivo.\n\n" +
      "Esta ação não pode ser desfeita. Deseja continuar?"
    );

    if (!confirmar) {
      if (globalBackupRef.current) globalBackupRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importado = JSON.parse(event.target.result as string);
        if (Array.isArray(importado) && importado.length > 0) {
          setSyncStatus('syncing');
          
          // Se o Supabase estiver configurado, tentamos sincronizar todos os projetos importados
          if (supabaseConfigured) {
            console.log('Iniciando sincronização de backup global com Supabase...');
            const { error } = await supabase
              .from('projetos')
              .upsert(importado.map(p => ({
                ...p,
                updated_at: new Date().toISOString()
              })));
            
            if (error) {
              console.error('Erro ao sincronizar backup com Supabase:', error);
              alert("Backup carregado localmente, mas houve erro ao sincronizar com a nuvem: " + error.message);
              setSyncStatus('error');
            } else {
              console.log('Backup global sincronizado com sucesso no Supabase.');
              setSyncStatus('synced');
            }
          }

          setProjetos(importado);
          setProjetoAtivoId(importado[0].id);
          alert("Backup Global restaurado com sucesso!");
        } else {
          alert("Arquivo de Backup Global inválido.");
        }
      } catch (err) { 
        console.error('Erro ao restaurar backup:', err);
        alert("Erro ao processar o arquivo de backup."); 
      }
    };
    reader.readAsText(file);
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
        } else { alert("Arquivo JSON inválido."); }
      } catch (err) { alert("Erro ao ler o arquivo."); }
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

  const onNodeDragStart = useCallback(() => { isDragging.current = true; }, []);
  const onNodeDragStop = useCallback(() => { setTimeout(() => { isDragging.current = false; }, 100); }, []);

  const onNodeClick = useCallback((_: any, node: any) => {
    if (isDragging.current) return;
    centralizarNoPalcoUtil([node]);
    setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));
  }, [centralizarNoPalcoUtil, setNodes]);

  const sincronizarTudoComNuvem = async () => {
    if (!supabaseConfigured) {
      alert("Supabase não configurado. Verifique os Secrets.");
      return;
    }

    const confirmar = window.confirm("Deseja sincronizar TODOS os sistemas locais com a nuvem? Isso irá sobrescrever dados com o mesmo ID no Supabase.");
    if (!confirmar) return;

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
      alert("Sincronização completa! Todos os sistemas foram enviados para a nuvem.");
    } catch (err: any) {
      addDebugLog(`Erro na sincronização manual: ${err.message}`);
      setSyncStatus('error');
      setSupabaseError(`Erro na sincronização: ${err.message}`);
      alert("Erro ao sincronizar: " + err.message);
    }
  };

  const projetoAtivo = projetos.find(p => p.id === projetoAtivoId);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden' }}>
      <style>{globalStyles}</style>

      {/* SIDEBAR ESQUERDA */}
      <div style={{ width: '280px', background: '#ffffff', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0', zIndex: 10 }}>
        {/* HEADER DA SIDEBAR */}
        <div style={{ padding: '30px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#2563eb', padding: '8px', borderRadius: '10px' }}><Droplet size={20} color="white" fill="white"/></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontSize: '11px', fontWeight: 800, color: '#1e3a8a', lineHeight: 1.2, textTransform: 'uppercase' }}>
                Sistemas de Produção <span style={{ color: '#3b82f6' }}>DESO</span>
              </h2>
              <div style={versionBadgeStyle}>BUILD {DEV_VERSION}</div>
            </div>
          </div>
        </div>
        
        {/* BOTÕES DE TOPO */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={async () => {
            const novo = { 
              id: generateUUID(),
              nome: 'NOVO PROJETO', 
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
            } catch (err: any) {
              addDebugLog(`ERRO ao criar projeto: ${err.message}`);
              alert(`Erro ao criar novo projeto: ${err.message}`);
            }
          }} style={btnNovoProjeto}>
            <Plus size={14} /> + Novo Projeto
          </button>
          
          <button onClick={() => fileInputRef.current?.click()} style={btnImportar}>
            <Upload size={14} /> Importar Arquivo JSON
          </button>
          <input type="file" ref={fileInputRef} onChange={lidarComImportacaoIndividual} accept=".json" style={{ display: 'none' }} />
        </div>

        {/* LISTA DE SISTEMAS (SCROLLABLE) */}
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '10px 16px' }}>
          <p style={labelSmall}>Sistemas Ativos</p>
          {projetos.map(p => (
            <div key={p.id} onClick={() => {
              if (projetoAtivoId !== p.id) {
                // Salva o estado atual antes de trocar
                const currentNodes = nodesRef.current;
                const currentEdges = edgesRef.current;
                setProjetos(prev => prev.map(proj => proj.id === projetoAtivoId ? { ...proj, nodes: currentNodes, edges: currentEdges } : proj));
                setProjetoAtivoId(p.id);
              }
            }} 
              style={{ ...itemProjeto, background: projetoAtivoId === p.id ? '#eff6ff' : 'transparent', borderColor: projetoAtivoId === p.id ? '#dbeafe' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
                <FileText size={15} color={projetoAtivoId === p.id ? '#3b82f6' : '#94a3b8'} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: projetoAtivoId === p.id ? '#1e40af' : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</span>
              </div>
              <div style={{ display: 'flex', gap: '2px' }}>
                <button onClick={(e) => { e.stopPropagation(); exportarSistema(p); }} style={btnMini} title="Exportar individual"><Download size={12} /></button>
                <button onClick={(e) => { 
                  e.stopPropagation(); 
                  const pCopia = { ...p, id: generateUUID(), nome: `${p.nome} (CÓPIA)`, updated_at: new Date().toISOString() };
                  
                  if (supabaseConfigured) {
                    supabase.from('projetos').insert([pCopia]).select().then(({data, error}) => {
                      if (error) {
                        alert(`Erro ao copiar: ${error.message}`);
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
                }} style={btnMini} title="Copiar"><Copy size={12} /></button>
                <button onClick={(e) => { 
                  e.stopPropagation(); 
                  if (projetos.length > 1) { 
                    const confirmar = window.confirm(`Deseja realmente excluir o sistema "${p.nome}"?`);
                    if (confirmar) {
                      if (supabaseConfigured) {
                        supabase.from('projetos').delete().eq('id', p.id).then(({ error }) => {
                          if (error) {
                            alert(`Erro ao excluir na nuvem: ${error.message}`);
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
                  } else {
                    alert("Atenção: Não é possível excluir o último sistema. É necessário ter ao menos um sistema ativo.");
                  }
                }} style={{ ...btnMini, color: '#ef4444' }} title="Apagar"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* BOTÕES DE BACKUP GLOBAL (PARTE INFERIOR) */}
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

        {/* CONSOLE DE DEPURAÇÃO (DEBUG) */}
        <div style={{ padding: '12px', borderTop: '1px solid #f1f5f9', background: '#1e293b', color: '#94a3b8', fontSize: '9px', fontFamily: 'monospace', maxHeight: '150px', overflowY: 'auto' }}>
          <p style={{ color: '#3b82f6', fontWeight: 800, marginBottom: '5px', fontSize: '10px' }}>LOG DE SINCRONIZAÇÃO</p>
          {debugLogs.length === 0 ? (
            <p>Nenhuma atividade registrada.</p>
          ) : (
            debugLogs.map((log, i) => <p key={i} style={{ marginBottom: '2px' }}>{log}</p>)
          )}
        </div>
      </div>

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={headerStyle}>
          <div style={{ flex: 1 }}>
            {modoEdicao ? (
              <input value={projetoAtivo?.nome || ''} 
                onChange={(e) => setProjetos(projetos.map(p => p.id === projetoAtivoId ? {...p, nome: e.target.value.toUpperCase()} : p))} 
                style={inputHeader} />
            ) : (
              <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>{projetoAtivo?.nome}</h1>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {(!supabaseConfigured || supabaseError) && (
              <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: '8px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <ShieldAlert size={16} color="#f97316" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#9a3412', lineHeight: 1 }}>
                    {!supabaseConfigured ? 'MODO OFFLINE' : 'ERRO NA NUVEM'}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 500, color: '#c2410c' }}>
                    {supabaseError || 'Configure o Supabase nos Secrets para salvar na nuvem.'}
                  </span>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '10px' }}>
              {syncStatus === 'syncing' && <RefreshCw size={14} className="animate-spin" color="#3b82f6" />}
              {syncStatus === 'synced' && <Cloud size={14} color="#10b981" />}
              {syncStatus === 'error' && <CloudOff size={14} color="#ef4444" />}
              <span style={{ fontSize: '10px', fontWeight: 700, color: syncStatus === 'error' ? '#ef4444' : '#64748b' }}>
                {syncStatus === 'syncing' ? 'Sincronizando...' : syncStatus === 'synced' ? 'Nuvem OK' : 'Erro de Conexão'}
              </span>
            </div>
            <button onClick={() => fitView({ duration: 800, padding: 0.4 })} style={btnSecundario}>Visão Geral</button>
            <button onClick={() => { 
              if (modoEdicao) {
                salvarNoSupabase();
              }
              setModoEdicao(!modoEdicao); 
              fecharPainel(); 
            }} style={{ ...btnPrimario, background: modoEdicao ? '#ef4444' : '#2563eb' }}>
              {modoEdicao ? 'Salvar Sistema' : 'Modo Edição'}
            </button>
          </div>
        </div>

        <div style={{ flexGrow: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes} edges={edges} nodeTypes={nodeTypes}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeClick={onNodeClick} onSelectionChange={onSelectionChange}
            onNodeDragStart={onNodeDragStart} onNodeDragStop={onNodeDragStop}
            onPaneClick={fecharPainel}
            nodesDraggable={modoEdicao} nodesConnectable={modoEdicao}
            deleteKeyCode={modoEdicao ? ["Backspace", "Delete"] : null}
            selectionMode={SelectionMode.Partial} selectNodesOnDrag={modoEdicao}
            connectionMode={ConnectionMode.Loose}
          >
            <Background color="#cbd5e1" variant={BackgroundVariant.Dots} gap={20} />
            <Controls />

            {modoEdicao && totalSelecionado > 1 && (
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
                  <button onClick={() => adicionarNo('Tratamento', 'ETA', '#f59e0b')} style={btnComp}><Beaker size={14}/> ETA</button>
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
        <div style={sidePanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700 }}>
              {selecionado.type === 'bulk' ? `Edição em Massa` : 'Configurações'}
            </h3>
            <button onClick={fecharPainel} style={btnClose}><X size={18} /></button>
          </div>
          
          {selecionado.type === 'bulk' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                 <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                    <Layers size={12} style={{verticalAlign:'middle', marginRight: '5px'}}/> 
                    {selecionado.nodeCount} nós e {selecionado.edgeCount} linhas
                 </p>
              </div>
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
const btnMini = { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' };
const headerStyle = { height: '80px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 30px', zIndex: 5 };
const inputHeader = { fontSize: '16px', fontWeight: 700, color: '#1e3a8a', border: 'none', borderBottom: '2px solid #3b82f6', outline: 'none', background: 'transparent', width: '100%', maxWidth: '400px' };
const btnPrimario = { padding: '10px 20px', borderRadius: '10px', border: 'none', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' };
const btnSecundario = { padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: 600, fontSize: '13px', cursor: 'pointer' };
const panelComponents = { background: 'white', padding: '15px', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '180px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' };
const btnComp = { padding: '10px', border: '1px solid #f1f5f9', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 500, textAlign: 'left' as const, color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' };
const sidePanel = { position: 'fixed' as const, right: 16, top: 16, bottom: 16, width: '300px', background: 'white', padding: '28px', borderRadius: '18px', boxShadow: '0 0 30px rgba(0,0,0,0.08)', zIndex: 100, display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0' };
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
