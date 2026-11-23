import { NextResponse } from "next/server";

// Destino de exigirPilarApi: o pedido é repetido aqui com o mesmo método (redirecionamento 307) e sempre recebe 403.
const negar = () => NextResponse.json({ erro: "Seu acesso não inclui esta área. Fale com a administradora." }, { status: 403 });
export { negar as GET, negar as POST, negar as PUT, negar as PATCH, negar as DELETE };
