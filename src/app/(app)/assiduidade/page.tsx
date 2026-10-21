import styles from "@/app/(app)/mentorados/mentorados.module.css";

export default function Page() {
  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Em construção</div>
          <div className={styles.pageSub}>Esta seção estará disponível em breve</div>
        </div>
      </div>
      <div className={styles.content} style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:200}}>
        <p style={{color:"var(--txt3)",fontSize:13}}>Página em desenvolvimento</p>
      </div>
    </>
  );
}
