# Plagas y cuidado de la finca

Cada amanecer actualiza los focos de insectos en las parcelas sembradas. El primer aviso aparece desde 15% de infestación; desde 30% empieza el daño de salud, desde 40% el foco se propaga a otros lotes y desde 70% se marca como crítico. La presión también reduce la cosecha proyectada, hasta un 30% adicional con infestación máxima.

El calor, el estrés hídrico y otros focos aceleran las plagas. Las semillas resistentes y el compost reducen su crecimiento; no vuelven al cultivo inmune. Son reglas del juego, no un modelo agronómico validado.

Acércate a una parcela en crecimiento con un foco activo y mantén **E** (o el botón táctil). La acción depende de la agricultura del lote:

| Modalidad | Acción | Energía | Coste | Reducción | Protección |
| --- | --- | --- | --- | --- | --- |
| Subsistencia | Retirada manual de insectos y hojas afectadas | 12 | Gratis | 55 puntos | 2 días |
| Precisión | Revisar y renovar trampas selectivas | 8 | 1.200 COP | 70 puntos | 2 días |
| Ecológica | Saneamiento y mantenimiento de barreras | 16 | Gratis | 45 puntos | 3 días |

El calor incrementa el esfuerzo un 25%, redondeando hacia arriba. En precisión, si no alcanza el presupuesto, el aviso ofrece retirada manual gratuita y cobra su esfuerzo. Una intervención por lote y día. Caminar o soltar cancela sin cobrar recursos. Ningún método recupera automáticamente la salud perdida. El compost ecológico reduce más el crecimiento de los focos.

En integral, P1 conserva subsistencia, P2 precisión y P3 ecológica. En los modos individuales, todos los lotes usan la modalidad seleccionada. La configuración `PEST_PROFILES` y `getPestAction` en `src/simulation/pests.js` alimentan los costes, duración, animación y textos; las pruebas verifican que lo anunciado coincida con lo cobrado.

Una parcela madura prioriza cosechar; una perdida prioriza retirar los restos. Ambas acciones eliminan el foco. Solo las cosechas sanas y sin infestación alta proporcionan semillas propias.

Los enjambres aumentan con la infestación, las hojas amarillean y el borde cambia de amarillo a rojo. El verde indica control activo. El panel **Vigilancia de plagas** detalla cada lote y puede plegarse. La casa muestra las labores pendientes. Amanecer recupera solo hasta 35 de energía; para recuperarse completamente hay que descansar en casa.

## Comprobación

`npm.cmd test -- --reporter=dot` y `npm.cmd run build`.

En el juego: sembrar, avanzar un día, observar el aviso y el enjambre, mantener E en la parcela, comprobar energía y borde verde, avanzar dos días y verificar que la protección se agota. Repetir sin tratar para observar daño y propagación. Las pruebas automatizadas cubren estas reglas, el orden de propagación, los rechazos sin gasto, la cosecha y los recursos visuales.
