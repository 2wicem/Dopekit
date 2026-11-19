import ServiceCatalogEditor from './ServiceCatalogEditor'

const OwnerSalonServices = ({ salon, onChanged, onStatus }) => {
  if (!salon) {
    return null
  }

  return (
    <ServiceCatalogEditor
      title={`${salon.name} menu`}
      lead={`Branch treatments at ${salon.name}. Anyone logging a job for this salon can pick these.`}
      services={salon.services || []}
      createPath={`/products/owner/salons/${salon.id}/services/`}
      deletePath={(service) => `/products/owner/services/${service.id}/`}
      onChanged={onChanged}
      onStatus={onStatus}
      idPrefix="owner-salon-service"
      emptyText="No salon services yet. Add your first one above."
    />
  )
}

export default OwnerSalonServices
