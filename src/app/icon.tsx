import { ImageResponse } from "next/og";

// Ícone do app (favicon + PWA) gerado em código — evita depender de um
// arquivo de imagem/ferramenta de geração externa. Alvo (🎯 Missões) em
// círculos concêntricos com a paleta de marca (laranja amazônico + dourado
// sobre preto editorial), sem cantos arredondados no fundo: ícones
// "maskable" precisam do quadrado cheio para o sistema aplicar a própria
// máscara sem revelar cantos vazados.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d0d0d",
        }}
      >
        <div
          style={{
            width: 320,
            height: 320,
            borderRadius: "50%",
            border: "28px solid #d4500a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 192,
              height: 192,
              borderRadius: "50%",
              border: "24px solid #c4952a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "#d4500a",
                display: "flex",
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
