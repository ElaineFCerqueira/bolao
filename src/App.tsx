import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  query, 
  getDocs,
  where
} from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAKmyZnTLrcswlzMOFeyxWuZ1DHnJw97js",
  authDomain: "bolao-brasil-marrocos.firebaseapp.com",
  projectId: "bolao-brasil-marrocos",
  storageBucket: "bolao-brasil-marrocos.firebasestorage.app",
  messagingSenderId: "748688496908",
  appId: "1:748688496908:web:ea6fb5fb8162011ef61129",
  measurementId: "G-NZPCD4EN0H"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'bolao-brasil-marrocos-v1';

// Configurações do Bolão
const CONFIG_CHAVE_PIX = "71992790879";
const CONFIG_NOME_PIX = "Elaine Cerqueira";
const CONFIG_VALOR_APOSTA = 10.00;
// Data real do jogo
const DATA_JOGO = new Date('2026-06-13T20:00:00');
const DATA_LIMITE_PALPITES = new Date(DATA_JOGO.getTime() - (60 * 60 * 1000)); // 1 hora antes do jogo

export default function App() {
  const [user, setUser] = useState(null);
  const [palpites, setPalpites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Estados do Formulário
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [golsBrasil, setGolsBrasil] = useState('');
  const [golsMarrocos, setGolsMarrocos] = useState('');
  
  // Estado de Sucesso (Modal de Pix)
  const [ultimoPalpiteCadastrado, setUltimoPalpiteCadastrado] = useState(null);
  const [copiadoPix, setCopiadoPix] = useState(false);

  // Estado do Temporizador
  const [tempoRestante, setTempoRestante] = useState({ horas: 0, minutos: 0, segundos: 0, encerrado: false });

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Erro ao autenticar anonimamente:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      if (usr) setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Coleção pública estruturada de acordo com as regras de ambiente
    const publicCollection = collection(db, 'artifacts', appId, 'public', 'data', 'palpites');
    
    const unsubscribe = onSnapshot(
      publicCollection, 
      (snapshot) => {
        const lista = [];
        snapshot.forEach((doc) => {
          lista.push({ id: doc.id, ...doc.data() });
        });
        // Classificação segura na memória para evitar complexidade de indexação
        lista.sort((a, b) => b.createdAt - a.createdAt);
        setPalpites(lista);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao carregar os palpites:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const calcularTempo = () => {
      const agora = new Date();
      const diferenca = DATA_LIMITE_PALPITES.getTime() - agora.getTime();

      if (diferenca <= 0) {
        setTempoRestante({ horas: 0, minutos: 0, segundos: 0, encerrado: true });
        return;
      }

      const horas = Math.floor(diferenca / (1000 * 60 * 60));
      const minutos = Math.floor((diferenca % (1000 * 60 * 60)) / (1000 * 60));
      const segundos = Math.floor((diferenca % (1000 * 60)) / 1000);

      setTempoRestante({ horas, minutos, segundos, encerrado: false });
    };

    calcularTempo();
    const interval = setInterval(calcularTempo, 1000);
    return () => clearInterval(interval);
  }, []);

  const contarRepeticaoPlacar = (golsBr, golsMa) => {
    return palpites.filter(p => p.golsBrasil === parseInt(golsBr) && p.golsMarrocos === parseInt(golsMa)).length;
  };

  const handleCadastrarPalpite = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (tempoRestante.encerrado) {
      setErrorMsg('O prazo de palpites para este bolão já se encerrou!');
      return;
    }

    if (!nome.trim() || !whatsapp.trim() || golsBrasil === '' || golsMarrocos === '') {
      setErrorMsg('Preencha todos os campos do formulário para palpitar!');
      return;
    }

    const gBr = parseInt(golsBrasil);
    const gMa = parseInt(golsMarrocos);

    if (isNaN(gBr) || isNaN(gMa) || gBr < 0 || gMa < 0) {
      setErrorMsg('Insira placares válidos!');
      return;
    }

    setSubmitting(true);

    try {
      const publicCollection = collection(db, 'artifacts', appId, 'public', 'data', 'palpites');
      
      const q = query(
        publicCollection, 
        where("golsBrasil", "==", gBr), 
        where("golsMarrocos", "==", gMa)
      );
      
      const snap = await getDocs(q);
      
      if (snap.size >= 2) {
        setErrorMsg(`Atenção: O placar Brasil ${gBr} x ${gMa} Marrocos já foi escolhido por 2 pessoas! Escolha outra combinação de gols.`);
        setSubmitting(false);
        return;
      }

      const novoPalpite = {
        nome: nome.trim(),
        whatsapp: whatsapp.trim(),
        golsBrasil: gBr,
        golsMarrocos: gMa,
        confirmado: false,
        createdAt: Date.now()
      };

      await addDoc(publicCollection, novoPalpite);

      setNome('');
      setWhatsapp('');
      setGolsBrasil('');
      setGolsMarrocos('');
      setUltimoPalpiteCadastrado(novoPalpite);

    } catch (err) {
      console.error(err);
      setErrorMsg('Erro de conexão ao enviar palpite. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const copiarPixParaAreaTransferencia = () => {
    const dummy = document.createElement("textarea");
    document.body.appendChild(dummy);
    dummy.value = CONFIG_CHAVE_PIX;
    dummy.select();
    document.execCommand("copy");
    document.body.removeChild(dummy);
    
    setCopiadoPix(true);
    setTimeout(() => setCopiadoPix(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-yellow-500 selection:text-slate-900">
      
      <header className="relative overflow-hidden bg-gradient-to-b from-green-900 via-green-950 to-slate-950 border-b border-green-900/40 py-8 px-4 text-center">
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-400 via-green-900 to-transparent"></div>
        
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-semibold mb-4 uppercase tracking-widest animate-pulse">
            ⚽️ Jogo Amistoso Premium
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase">
            Bolão <span className="text-yellow-400">Brasil</span> x Marrocos
          </h1>
          <p className="mt-2 text-slate-400 text-sm md:text-base max-w-xl mx-auto">
            Faça sua aposta, torça com os amigos e concorra à premiação total!
          </p>

          {/* Destaque do Preço da Aposta e Contador */}
          <div className="mt-6 inline-flex flex-col sm:flex-row items-center gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl max-w-md mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div className="text-left">
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Valor do Palpite</span>
                <p className="text-2xl font-black text-emerald-400">R$ {CONFIG_VALOR_APOSTA.toFixed(2).replace('.', ',')}</p>
              </div>
            </div>
            <div className="w-px h-8 bg-slate-800 hidden sm:block"></div>
            <div className="text-center sm:text-left">
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider block">Falta apenas</span>
              {tempoRestante.encerrado ? (
                <span className="text-red-500 font-bold text-sm bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 mt-1 inline-block">Inscrições Encerradas</span>
              ) : (
                <span className="text-yellow-400 font-mono font-bold text-lg">
                  {tempoRestante.horas}h {tempoRestante.minutos}m {tempoRestante.segundos}s
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      {}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUNA ESQUERDA: FORMULÁRIO */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl pointer-events-none"></div>
            
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
              <span className="w-2 h-6 bg-yellow-400 rounded-full"></span>
              Envie Seu Palpite
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Lembre-se: o mesmo placar exato só pode ser escolhido por no máximo 2 participantes. Garanta o seu antes que lote!
            </p>

            {tempoRestante.encerrado ? (
              <div className="bg-slate-950 border border-red-900/30 rounded-2xl p-6 text-center">
                <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0-6v2m0-8H7.294C5.074 5 3 6.965 3 9.385v5.23C3 17.035 5.074 19 7.294 19h9.412C18.926 19 21 17.035 21 14.615v-5.23C21 6.965 18.926 5 16.706 5H12z" /></svg>
                </div>
                <h3 className="text-base font-bold text-red-400 mb-1">Palpites Encerrados</h3>
                <p className="text-xs text-slate-400">O prazo final para registro expirou 1h antes do início do jogo.</p>
              </div>
            ) : (
              <form onSubmit={handleCadastrarPalpite} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Nome Completo</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Carlos Silva"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">WhatsApp</label>
                  <input 
                    type="tel" 
                    placeholder="Ex: (11) 99999-9999"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
                    required
                  />
                </div>

                {/* PLACAR INTERATIVO */}
                {}
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 my-4">
                  <div className="text-center text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Insira o Placar</div>
                  <div className="flex items-center justify-center gap-4">
                    {/* Brasil */}
                    <div className="flex flex-col items-center flex-1">
                      <div className="flex items-center gap-1 mb-2">
                        <span className="text-lg">🇧🇷</span>
                        <span className="text-xs font-bold text-slate-300">Brasil</span>
                      </div>
                      <input 
                        type="number" 
                        min="0"
                        placeholder="0"
                        value={golsBrasil}
                        onChange={(e) => setGolsBrasil(e.target.value)}
                        className="w-16 h-16 bg-slate-900 border-2 border-slate-800 rounded-2xl text-center text-3xl font-black text-yellow-400 focus:outline-none focus:border-yellow-400 focus:ring-0 transition"
                        required
                      />
                    </div>

                    <div className="text-slate-600 font-bold text-xl pt-6">X</div>

                    {/* Marrocos */}
                    <div className="flex flex-col items-center flex-1">
                      <div className="flex items-center gap-1 mb-2">
                        <span className="text-lg">🇲🇦</span>
                        <span className="text-xs font-bold text-slate-300">Marrocos</span>
                      </div>
                      <input 
                        type="number" 
                        min="0"
                        placeholder="0"
                        value={golsMarrocos}
                        onChange={(e) => setGolsMarrocos(e.target.value)}
                        className="w-16 h-16 bg-slate-900 border-2 border-slate-800 rounded-2xl text-center text-3xl font-black text-green-400 focus:outline-none focus:border-green-400 focus:ring-0 transition"
                        required
                      />
                    </div>
                  </div>

                  {/* Pré-validador dinâmico em tempo real do limite */}
                  {golsBrasil !== '' && golsMarrocos !== '' && (
                    <div className="mt-4 text-center">
                      {contarRepeticaoPlacar(golsBrasil, golsMarrocos) >= 2 ? (
                        <div className="text-xs text-red-400 font-semibold bg-red-500/10 py-2 px-3 rounded-lg border border-red-500/20">
                          ⚠️ Placar esgotado! Já existem 2 palpites para esse resultado.
                        </div>
                      ) : (
                        <div className="text-xs text-green-400 font-semibold bg-green-500/10 py-2 px-3 rounded-lg border border-green-500/20">
                          ✅ Placar disponível! ({contarRepeticaoPlacar(golsBrasil, golsMarrocos)}/2 escolhas usadas)
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <div className="bg-red-500/15 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-xs font-medium">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || (golsBrasil !== '' && golsMarrocos !== '' && contarRepeticaoPlacar(golsBrasil, golsMarrocos) >= 2)}
                  className={`w-full py-4 px-6 rounded-xl font-bold uppercase tracking-wider text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
                    submitting || (golsBrasil !== '' && golsMarrocos !== '' && contarRepeticaoPlacar(golsBrasil, golsMarrocos) >= 2)
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-yellow-500 to-green-600 hover:from-yellow-400 hover:to-green-500 text-slate-950 hover:scale-[1.01] active:scale-[0.99]'
                  }`}
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-slate-950" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verificando no Banco...
                    </>
                  ) : 'Confirmar Meu Palpite'}
                </button>
              </form>
            )}
          </div>

          {/* REGRAS RÁPIDAS */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-6">
            <h3 className="font-bold text-sm text-slate-200 mb-3 flex items-center gap-2">
              📋 Regras Básicas do Bolão
            </h3>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 font-bold">1.</span>
                <span>O valor de participação é estritamente <strong>R$ 10,00 por palpite</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 font-bold">2.</span>
                <span>Cada participante pode apostar no máximo em 2 placares idênticos. O sistema bloqueia automaticamente a partir da 3ª tentativa.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 font-bold">3.</span>
                <span>O palpite só será validado no Dashboard após a confirmação do Pix enviado.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 font-bold">4.</span>
                <span>Premiação será distribuída proporcionalmente aos acertadores do placar em cheio. Se ninguém acertar em cheio, o prêmio acumula ou vai para quem acertar o vencedor e saldo.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* COLUNA DIREITA: DASHBOARD EM TEMPO REAL DE PALPITES */}
        {}
        <section className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex-1 flex flex-col min-h-[500px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-6 bg-green-500 rounded-full"></span>
                  Placar Geral de Palpites
                </h2>
                <p className="text-xs text-slate-400 mt-1">Acompanhe todos os inscritos e garanta que o seu foi validado.</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-xs flex items-center gap-2 self-start sm:self-center">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span>
                <span>{palpites.length} {palpites.length === 1 ? 'Palpite ativo' : 'Palpites ativos'}</span>
              </div>
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12">
                <svg className="animate-spin h-8 w-8 text-yellow-400 mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-sm text-slate-500 font-medium">Carregando painel de palpites...</p>
              </div>
            ) : palpites.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-4">
                  ⚽️
                </div>
                <h3 className="text-base font-bold text-slate-300 mb-1">Nenhum palpite enviado ainda</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Seja o primeiro a enviar seu palpite e defina a tendência do bolão!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      <th className="py-3 px-4">Participante</th>
                      <th className="py-3 px-4 text-center">Palpite</th>
                      <th className="py-3 px-4 text-right">Status do Pix</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {palpites.map((palp) => (
                      <tr key={palp.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-200 text-sm">{palp.nome}</p>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {palp.whatsapp.replace(/\D/g, '').slice(-4).padStart(palp.whatsapp.length, '*')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl font-black text-sm text-white font-mono shadow-sm">
                            <span className="text-xs">🇧🇷</span> {palp.golsBrasil}
                            <span className="text-slate-600 text-xs">x</span>
                            {palp.golsMarrocos} <span className="text-xs">🇲🇦</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {palp.confirmado ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              Confirmado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[11px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
                              Aguardando Pix
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="mt-12 border-t border-slate-900 bg-slate-950 py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto space-y-2">
          <p>Bolão da Galera!!! se joga! • </p>
          <p className="text-slate-600">Desenvolvido por Elaine Cerqueira.</p>
        </div>
      </footer>

      {/* MODAL DE SUCESSO E PAGAMENTO PIX */}
      {}
      {ultimoPalpiteCadastrado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            
            <div className="w-12 h-12 bg-green-500/15 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h3 className="text-xl font-bold text-white text-center mb-1">Palpite Pré-Reservado!</h3>
            <p className="text-slate-400 text-xs text-center mb-6">
              Para efetivar seu palpite no sistema de forma permanente, conclua o pagamento da inscrição por Pix.
            </p>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-6 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Seu Palpite</span>
              <div className="flex items-center justify-center gap-3 font-mono">
                <span className="text-xs text-slate-300">{ultimoPalpiteCadastrado.nome}</span>
                <span className="text-slate-700">|</span>
                <span className="font-black text-white text-lg">
                  🇧🇷 {ultimoPalpiteCadastrado.golsBrasil} x {ultimoPalpiteCadastrado.golsMarrocos} 🇲🇦
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center mb-2">
                  Valor para transferência
                </label>
                <div className="text-3xl font-black text-center text-emerald-400">
                  R$ {CONFIG_VALOR_APOSTA.toFixed(2).replace('.', ',')}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Chave Pix (Copia e Cola)
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={CONFIG_CHAVE_PIX}
                    className="flex-1 bg-transparent border-none text-xs font-mono text-slate-300 p-0 focus:outline-none focus:ring-0"
                  />
                  <button 
                    onClick={copiarPixParaAreaTransferencia}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      copiadoPix 
                        ? 'bg-emerald-500 text-slate-950' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {copiadoPix ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-center text-xs text-slate-300">
                💡 Após fazer o Pix em sua conta bancária, envie o comprovante para o administrador validar seu palpite.
              </div>

              <button 
                onClick={() => setUltimoPalpiteCadastrado(null)}
                className="w-full mt-2 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition"
              >
                Voltar ao Dashboard
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
