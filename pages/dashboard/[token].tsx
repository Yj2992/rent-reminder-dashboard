export default function LegacyTenantDashboard(){return null}

export async function getServerSideProps(){
  return {redirect:{destination:"/login?reason=secure-tenant-access",permanent:false}}
}
