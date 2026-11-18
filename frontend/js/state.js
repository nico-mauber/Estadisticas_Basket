// Estado compartido de la SPA (X-01): las variables de nivel superior que antes vivían en app.js. Un objeto mutable
// porque los bindings de un módulo ES son de solo lectura para quien los importa y el router, las vistas y la
// configuración las asignan desde módulos distintos.
export const S = {
  activeSection: "import",
  _lastSection: "import",
  _routing: false,   // true mientras se aplica una dirección: la vista no la vuelve a escribir (X-01)
  _routeQuery: null,   // competencia y últimos N de la dirección abierta; los consume la carga de equipo o jugador
  _gameId: null,   // partido abierto en Partido (para la dirección)
  _gameTab: null,   // pestaña de ese partido (resumen, box, tiros…)
  _trendsState: { team: {}, player: {} },   // métricas, media móvil y N de Evolución y tendencias (F-18)
  _similar: { position: "", min: "" },   // filtros de Jugador › Similares (A-09)
  _leaders: { metric: "", min: "" },   // métrica y mínimo de minutos de Liga › Líderes (F-14)
  _versusRival: "",   // rival elegido en Equipo › Enfrentamiento (F-20)
  _navCount: 0,   // cuántas veces se cambió de sección: la sección inicial no pisa una elección del usuario
  importPage: 0,
  selectMode: false,
  selectedGames: new Set(),
  _seedEnabled: false,   // dev-only seed button (set from /api/me at boot)
  _authRequired: false,   // whether the backend requires login
  _authUser: null,   // logged-in username (when auth required)
  _isAdmin: false,   // puede modificar datos (F-11, /api/me → is_admin)
  _llmEnabled: false,   // sugerencias asistidas por IA disponibles (F-15, /api/me → llm_enabled)
  _importTab: "importar",   // importar · calidad · competencias (F-11)
  _catalogComp: "",   // filtro del catálogo por competencia
  _qualityComp: "",   // competencia elegida en Calidad de datos
  _leagueTeams: [],
  _leagueSummary: null,   // {avg, leaders, population} de include=summary (T-01), alimenta el mapa
  _leagueMap: "ef",
  _leagueComp: null,   // null = la competencia por defecto (se resuelve al cargar); "all" = todas
  _clutchData: null,   // se mantiene para resetear al cambiar de equipo/competencia
  _clutchReq: 0,   // descarta respuestas viejas al cambiar de equipo o competencia
  _clutchStdReq: 0,
  _teamData: null,
  _teamLastN: 0,   // 0 = todos los partidos de la competencia
  _teamComp: null,   // id de competencia (string) o "all"; null = todavía sin resolver (la elige el servidor)
  _teamReq: 0,   // descarta respuestas viejas al cambiar de equipo, de competencia o de filtro
  _teamStdReq: 0,
  _teamCardGroups: null,
  _pendingLineup: null,
  _ctxTeam: null,   // último equipo mostrado: con/sin jugador no viajan a otro equipo
  _cmpTabsBound: false,
  _playerData: null,
  _playerComp: null,   // id de competencia (string) o "all"; null = la elige el servidor
  _playerCtx: { teamCode: "", playerName: "" },
  _playerReq: 0,   // descarta respuestas viejas
  _playerLastN: 0,   // 0 = todos los partidos (chips de período de la cabecera, F-19)
  _playerStdReq: 0,
  _playerCardGroups: null,
  _simX: { team: "", player: "", position: "", min: "" },   // Explorar › Similares (A-09)
  _cross: { team: "", side: "ataque", dimX: "tramo", dimY: "origen", metric: "ppp", limit: 8, color: "", competition: "", last: "" },   // A-06
  _searchTab: "jugadores",
  _searchInit: null,   // parámetros a restaurar al abrir la pestaña (consulta guardada o dirección)
  _searchStale: false,   // la consulta que se abre se guardó con otros datos o configuración
  _searchLastParams: null,   // última búsqueda de quintetos (la pestaña la recuerda al volver)
  _searchKeys: new Set(),   // claves de la búsqueda que hoy están en la dirección
  _searchComp: "",   // id de competencia del último fetch ("" = todas)
  _searchTable: null,   // handle de createDataTable
  _searchPayload: null,   // payload actual (para el mapa de índices de columnas)
  _searchColIdx: {},   // key → índice en payload.columns
  _configTab: null,   // módulo de Configuración abierto (pestaña; X-01 CA-15)
};
