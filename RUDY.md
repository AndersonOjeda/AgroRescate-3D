# Rudy: guía de las reglas y del estado de la partida

Rudy asesora sobre todos los surcos, incluyendo los no seleccionados. Antes de una consulta, diagnóstico o viñeta automática, el HUD toma una nueva lectura de la simulación. No depende únicamente del último menú abierto.

`src/ai/rudyKnowledge.js` resuelve preguntas sobre objetivo y victoria, inicio, acciones bloqueadas, siembra y preparación, recursos, compras, compost, abonado, pisoteo, orientación solar y plagas. `rudyAdvisor.js` completa la revisión hídrica, modalidades, tiempo y descanso, y genera el diagnóstico priorizado.

Las respuestas de plagas usan la acción y costes que produce el motor para cada surco. Distinguen cultivos perdidos, cosecha lista y protección vigente. El abonado consulta la misma función `fertilizerAdvice` que la jugabilidad. Las consultas de descanso leen `restAvailability`, y la meta lee `goal`.

Es un asesor local basado en reglas y datos del juego, no un modelo de lenguaje externo. Para ampliar una mecánica, actualizar su módulo de simulación, la regla correspondiente aquí y las pruebas. No presentar acciones que el juego aún no ofrece. Si una pregunta no se reconoce, mostrar el diagnóstico actual como ayuda general, sin afirmar haber identificado ese problema concreto.

Las preguntas rápidas permiten acceder a inicio y meta, agua, plagas, modos, abonado, compras y problemas para trabajar. Las alertas automáticas mantienen intervalos para no interrumpir continuamente y respetan su desactivación por el jugador.
