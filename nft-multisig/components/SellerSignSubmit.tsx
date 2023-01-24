import { useState } from 'react'

const sellerSignSubmit = ({ onSellerSignSubmit } : any) => {


    const onSubmit = (e : any) => {
        
        e.preventDefault(); // prevent full page refresh
        onSellerSignSubmit();
    }

    return (

        <form onSubmit={onSubmit}>
            <div>
                <b>Seller Sign And Submit NFT Transaction</b> 
                <p></p>                 
            </div>
            <br></br>                   
            <input type='submit' value='Seller Sign and Submit Tx'/>
        </form>
    )
}

export default sellerSignSubmit