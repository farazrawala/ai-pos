import { useEffect } from 'react';
// import { useParams } from 'react-router-dom';

const Category = () => {
  useEffect(() => {
    // Initialize DataTables after component mounts
    let dataTableSearch = null;

    const initDataTables = () => {
      // Check if the library is loaded
      if (typeof window.simpleDatatables === 'undefined') {
        console.warn('simpleDatatables library not loaded yet');
        return false;
      }

      // Check if table element exists
      const searchTable = document.getElementById('datatable-search');

      if (!searchTable) {
        console.warn('Table element not found');
        return false;
      }

      // Check if DataTable is already initialized on this table
      if (searchTable.dataset.simpleDatatables) {
        console.log('DataTable already initialized');
        return true;
      }

      try {
        dataTableSearch = new window.simpleDatatables.DataTable('#datatable-search', {
          searchable: true,
          fixedHeight: true,
        });
        console.log('DataTable Search initialized successfully');
        return true;
      } catch (error) {
        console.error('DataTables initialization error:', error);
        return false;
      }
    };

    // Function to wait for library and initialize
    const waitAndInit = () => {
      let attempts = 0;
      const maxAttempts = 30; // Try for 3 seconds (30 * 100ms)

      const checkAndInit = () => {
        if (initDataTables()) {
          return; // Successfully initialized
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkAndInit, 100);
        } else {
          console.error(
            'Failed to initialize DataTables after multiple attempts. Make sure datatables.js is loaded.'
          );
        }
      };

      checkAndInit();
    };

    // Start initialization after a short delay to ensure DOM is ready
    const timeoutId = setTimeout(waitAndInit, 200);

    // Cleanup function to destroy DataTables on unmount
    return () => {
      clearTimeout(timeoutId);
      if (dataTableSearch) {
        try {
          dataTableSearch.destroy();
        } catch (error) {
          console.error('Error destroying dataTableSearch:', error);
        }
      }
    };
  }, []);
  //   const { first_param } = useParams(); // first = "categories"
  const firstSegment = window.location.pathname.split('/')[1];

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '100%' }}>
            <div className="card-header">
              <h5 className="mb-0">
                {firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)}
              </h5>
              <p className="text-sm mb-0">
                A lightweight, extendable, dependency-free javascript HTML table plugin.
              </p>
            </div>
            <div className="table-responsive">
              <table className="table table-flush" id="datatable-search">
                <thead className="thead-light">
                  <tr>
                    <th>Name</th>
                    <th>Position</th>
                    <th>Office</th>
                    <th>Age</th>
                    <th>Start date</th>
                    <th>Salary</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-sm font-weight-normal">Tiger Nixon</td>
                    <td className="text-sm font-weight-normal">System Architect</td>
                    <td className="text-sm font-weight-normal">Edinburgh</td>
                    <td className="text-sm font-weight-normal">61</td>
                    <td className="text-sm font-weight-normal">2011/04/25</td>
                    <td className="text-sm font-weight-normal">$320,800</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Garrett Winters</td>
                    <td className="text-sm font-weight-normal">Accountant</td>
                    <td className="text-sm font-weight-normal">Tokyo</td>
                    <td className="text-sm font-weight-normal">63</td>
                    <td className="text-sm font-weight-normal">2011/07/25</td>
                    <td className="text-sm font-weight-normal">$170,750</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Ashton Cox</td>
                    <td className="text-sm font-weight-normal">Junior Technical Author</td>
                    <td className="text-sm font-weight-normal">San Francisco</td>
                    <td className="text-sm font-weight-normal">66</td>
                    <td className="text-sm font-weight-normal">2009/01/12</td>
                    <td className="text-sm font-weight-normal">$86,000</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Cedric Kelly</td>
                    <td className="text-sm font-weight-normal">Senior Javascript Developer</td>
                    <td className="text-sm font-weight-normal">Edinburgh</td>
                    <td className="text-sm font-weight-normal">22</td>
                    <td className="text-sm font-weight-normal">2012/03/29</td>
                    <td className="text-sm font-weight-normal">$433,060</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Airi Satou</td>
                    <td className="text-sm font-weight-normal">Accountant</td>
                    <td className="text-sm font-weight-normal">Tokyo</td>
                    <td className="text-sm font-weight-normal">33</td>
                    <td className="text-sm font-weight-normal">2008/11/28</td>
                    <td className="text-sm font-weight-normal">$162,700</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Brielle Williamson</td>
                    <td className="text-sm font-weight-normal">Integration Specialist</td>
                    <td className="text-sm font-weight-normal">New York</td>
                    <td className="text-sm font-weight-normal">61</td>
                    <td className="text-sm font-weight-normal">2012/12/02</td>
                    <td className="text-sm font-weight-normal">$372,000</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Herrod Chandler</td>
                    <td className="text-sm font-weight-normal">Sales Assistant</td>
                    <td className="text-sm font-weight-normal">San Francisco</td>
                    <td className="text-sm font-weight-normal">59</td>
                    <td className="text-sm font-weight-normal">2012/08/06</td>
                    <td className="text-sm font-weight-normal">$137,500</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Rhona Davidson</td>
                    <td className="text-sm font-weight-normal">Integration Specialist</td>
                    <td className="text-sm font-weight-normal">Tokyo</td>
                    <td className="text-sm font-weight-normal">55</td>
                    <td className="text-sm font-weight-normal">2010/10/14</td>
                    <td className="text-sm font-weight-normal">$327,900</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Colleen Hurst</td>
                    <td className="text-sm font-weight-normal">Javascript Developer</td>
                    <td className="text-sm font-weight-normal">San Francisco</td>
                    <td className="text-sm font-weight-normal">39</td>
                    <td className="text-sm font-weight-normal">2009/09/15</td>
                    <td className="text-sm font-weight-normal">$205,500</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Sonya Frost</td>
                    <td className="text-sm font-weight-normal">Software Engineer</td>
                    <td className="text-sm font-weight-normal">Edinburgh</td>
                    <td className="text-sm font-weight-normal">23</td>
                    <td className="text-sm font-weight-normal">2008/12/13</td>
                    <td className="text-sm font-weight-normal">$103,600</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Jena Gaines</td>
                    <td className="text-sm font-weight-normal">Office Manager</td>
                    <td className="text-sm font-weight-normal">London</td>
                    <td className="text-sm font-weight-normal">30</td>
                    <td className="text-sm font-weight-normal">2008/12/19</td>
                    <td className="text-sm font-weight-normal">$90,560</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Quinn Flynn</td>
                    <td className="text-sm font-weight-normal">Support Lead</td>
                    <td className="text-sm font-weight-normal">Edinburgh</td>
                    <td className="text-sm font-weight-normal">22</td>
                    <td className="text-sm font-weight-normal">2013/03/03</td>
                    <td className="text-sm font-weight-normal">$342,000</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Charde Marshall</td>
                    <td className="text-sm font-weight-normal">Regional Director</td>
                    <td className="text-sm font-weight-normal">San Francisco</td>
                    <td className="text-sm font-weight-normal">36</td>
                    <td className="text-sm font-weight-normal">2008/10/16</td>
                    <td className="text-sm font-weight-normal">$470,600</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Haley Kennedy</td>
                    <td className="text-sm font-weight-normal">Senior Marketing Designer</td>
                    <td className="text-sm font-weight-normal">London</td>
                    <td className="text-sm font-weight-normal">43</td>
                    <td className="text-sm font-weight-normal">2012/12/18</td>
                    <td className="text-sm font-weight-normal">$313,500</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Tatyana Fitzpatrick</td>
                    <td className="text-sm font-weight-normal">Regional Director</td>
                    <td className="text-sm font-weight-normal">London</td>
                    <td className="text-sm font-weight-normal">19</td>
                    <td className="text-sm font-weight-normal">2010/03/17</td>
                    <td className="text-sm font-weight-normal">$385,750</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Michael Silva</td>
                    <td className="text-sm font-weight-normal">Marketing Designer</td>
                    <td className="text-sm font-weight-normal">London</td>
                    <td className="text-sm font-weight-normal">66</td>
                    <td className="text-sm font-weight-normal">2012/11/27</td>
                    <td className="text-sm font-weight-normal">$198,500</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Paul Byrd</td>
                    <td className="text-sm font-weight-normal">Chief Financial Officer (CFO)</td>
                    <td className="text-sm font-weight-normal">New York</td>
                    <td className="text-sm font-weight-normal">64</td>
                    <td className="text-sm font-weight-normal">2010/06/09</td>
                    <td className="text-sm font-weight-normal">$725,000</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Gloria Little</td>
                    <td className="text-sm font-weight-normal">Systems Administrator</td>
                    <td className="text-sm font-weight-normal">New York</td>
                    <td className="text-sm font-weight-normal">59</td>
                    <td className="text-sm font-weight-normal">2009/04/10</td>
                    <td className="text-sm font-weight-normal">$237,500</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Bradley Greer</td>
                    <td className="text-sm font-weight-normal">Software Engineer</td>
                    <td className="text-sm font-weight-normal">London</td>
                    <td className="text-sm font-weight-normal">41</td>
                    <td className="text-sm font-weight-normal">2012/10/13</td>
                    <td className="text-sm font-weight-normal">$132,000</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Dai Rios</td>
                    <td className="text-sm font-weight-normal">Personnel Lead</td>
                    <td className="text-sm font-weight-normal">Edinburgh</td>
                    <td className="text-sm font-weight-normal">35</td>
                    <td className="text-sm font-weight-normal">2012/09/26</td>
                    <td className="text-sm font-weight-normal">$217,500</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Jenette Caldwell</td>
                    <td className="text-sm font-weight-normal">Development Lead</td>
                    <td className="text-sm font-weight-normal">New York</td>
                    <td className="text-sm font-weight-normal">30</td>
                    <td className="text-sm font-weight-normal">2011/09/03</td>
                    <td className="text-sm font-weight-normal">$345,000</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Yuri Berry</td>
                    <td className="text-sm font-weight-normal">Chief Marketing Officer (CMO)</td>
                    <td className="text-sm font-weight-normal">New York</td>
                    <td className="text-sm font-weight-normal">40</td>
                    <td className="text-sm font-weight-normal">2009/06/25</td>
                    <td className="text-sm font-weight-normal">$675,000</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Caesar Vance</td>
                    <td className="text-sm font-weight-normal">Pre-Sales Support</td>
                    <td className="text-sm font-weight-normal">New York</td>
                    <td className="text-sm font-weight-normal">21</td>
                    <td className="text-sm font-weight-normal">2011/12/12</td>
                    <td className="text-sm font-weight-normal">$106,450</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Doris Wilder</td>
                    <td className="text-sm font-weight-normal">Sales Assistant</td>
                    <td className="text-sm font-weight-normal">Sidney</td>
                    <td className="text-sm font-weight-normal">23</td>
                    <td className="text-sm font-weight-normal">2010/09/20</td>
                    <td className="text-sm font-weight-normal">$85,600</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Angelica Ramos</td>
                    <td className="text-sm font-weight-normal">Chief Executive Officer (CEO)</td>
                    <td className="text-sm font-weight-normal">London</td>
                    <td className="text-sm font-weight-normal">47</td>
                    <td className="text-sm font-weight-normal">2009/10/09</td>
                    <td className="text-sm font-weight-normal">$1,200,000</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Gavin Joyce</td>
                    <td className="text-sm font-weight-normal">Developer</td>
                    <td className="text-sm font-weight-normal">Edinburgh</td>
                    <td className="text-sm font-weight-normal">42</td>
                    <td className="text-sm font-weight-normal">2010/12/22</td>
                    <td className="text-sm font-weight-normal">$92,575</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Jennifer Chang</td>
                    <td className="text-sm font-weight-normal">Regional Director</td>
                    <td className="text-sm font-weight-normal">Singapore</td>
                    <td className="text-sm font-weight-normal">28</td>
                    <td className="text-sm font-weight-normal">2010/11/14</td>
                    <td className="text-sm font-weight-normal">$357,650</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Brenden Wagner</td>
                    <td className="text-sm font-weight-normal">Software Engineer</td>
                    <td className="text-sm font-weight-normal">San Francisco</td>
                    <td className="text-sm font-weight-normal">28</td>
                    <td className="text-sm font-weight-normal">2011/06/07</td>
                    <td className="text-sm font-weight-normal">$206,850</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Fiona Green</td>
                    <td className="text-sm font-weight-normal">Chief Operating Officer (COO)</td>
                    <td className="text-sm font-weight-normal">San Francisco</td>
                    <td className="text-sm font-weight-normal">48</td>
                    <td className="text-sm font-weight-normal">2010/03/11</td>
                    <td className="text-sm font-weight-normal">$850,000</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Shou Itou</td>
                    <td className="text-sm font-weight-normal">Regional Marketing</td>
                    <td className="text-sm font-weight-normal">Tokyo</td>
                    <td className="text-sm font-weight-normal">20</td>
                    <td className="text-sm font-weight-normal">2011/08/14</td>
                    <td className="text-sm font-weight-normal">$163,000</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Michelle House</td>
                    <td className="text-sm font-weight-normal">Integration Specialist</td>
                    <td className="text-sm font-weight-normal">Sidney</td>
                    <td className="text-sm font-weight-normal">37</td>
                    <td className="text-sm font-weight-normal">2011/06/02</td>
                    <td className="text-sm font-weight-normal">$95,400</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Suki Burks</td>
                    <td className="text-sm font-weight-normal">Developer</td>
                    <td className="text-sm font-weight-normal">London</td>
                    <td className="text-sm font-weight-normal">53</td>
                    <td className="text-sm font-weight-normal">2009/10/22</td>
                    <td className="text-sm font-weight-normal">$114,500</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Prescott Bartlett</td>
                    <td className="text-sm font-weight-normal">Technical Author</td>
                    <td className="text-sm font-weight-normal">London</td>
                    <td className="text-sm font-weight-normal">27</td>
                    <td className="text-sm font-weight-normal">2011/05/07</td>
                    <td className="text-sm font-weight-normal">$145,000</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Gavin Cortez</td>
                    <td className="text-sm font-weight-normal">Team Leader</td>
                    <td className="text-sm font-weight-normal">San Francisco</td>
                    <td className="text-sm font-weight-normal">22</td>
                    <td className="text-sm font-weight-normal">2008/10/26</td>
                    <td className="text-sm font-weight-normal">$235,500</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Martena Mccray</td>
                    <td className="text-sm font-weight-normal">Post-Sales support</td>
                    <td className="text-sm font-weight-normal">Edinburgh</td>
                    <td className="text-sm font-weight-normal">46</td>
                    <td className="text-sm font-weight-normal">2011/03/09</td>
                    <td className="text-sm font-weight-normal">$324,050</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Unity Butler</td>
                    <td className="text-sm font-weight-normal">Marketing Designer</td>
                    <td className="text-sm font-weight-normal">San Francisco</td>
                    <td className="text-sm font-weight-normal">47</td>
                    <td className="text-sm font-weight-normal">2009/12/09</td>
                    <td className="text-sm font-weight-normal">$85,675</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Howard Hatfield</td>
                    <td className="text-sm font-weight-normal">Office Manager</td>
                    <td className="text-sm font-weight-normal">San Francisco</td>
                    <td className="text-sm font-weight-normal">51</td>
                    <td className="text-sm font-weight-normal">2008/12/16</td>
                    <td className="text-sm font-weight-normal">$164,500</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Hope Fuentes</td>
                    <td className="text-sm font-weight-normal">Secretary</td>
                    <td className="text-sm font-weight-normal">San Francisco</td>
                    <td className="text-sm font-weight-normal">41</td>
                    <td className="text-sm font-weight-normal">2010/02/12</td>
                    <td className="text-sm font-weight-normal">$109,850</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Vivian Harrell</td>
                    <td className="text-sm font-weight-normal">Financial Controller</td>
                    <td className="text-sm font-weight-normal">San Francisco</td>
                    <td className="text-sm font-weight-normal">62</td>
                    <td className="text-sm font-weight-normal">2009/02/14</td>
                    <td className="text-sm font-weight-normal">$452,500</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Timothy Mooney</td>
                    <td className="text-sm font-weight-normal">Office Manager</td>
                    <td className="text-sm font-weight-normal">London</td>
                    <td className="text-sm font-weight-normal">37</td>
                    <td className="text-sm font-weight-normal">2008/12/11</td>
                    <td className="text-sm font-weight-normal">$136,200</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Jackson Bradshaw</td>
                    <td className="text-sm font-weight-normal">Director</td>
                    <td className="text-sm font-weight-normal">New York</td>
                    <td className="text-sm font-weight-normal">65</td>
                    <td className="text-sm font-weight-normal">2008/09/26</td>
                    <td className="text-sm font-weight-normal">$645,750</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Olivia Liang</td>
                    <td className="text-sm font-weight-normal">Support Engineer</td>
                    <td className="text-sm font-weight-normal">Singapore</td>
                    <td className="text-sm font-weight-normal">64</td>
                    <td className="text-sm font-weight-normal">2011/02/03</td>
                    <td className="text-sm font-weight-normal">$234,500</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Bruno Nash</td>
                    <td className="text-sm font-weight-normal">Software Engineer</td>
                    <td className="text-sm font-weight-normal">London</td>
                    <td className="text-sm font-weight-normal">38</td>
                    <td className="text-sm font-weight-normal">2011/05/03</td>
                    <td className="text-sm font-weight-normal">$163,500</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Sakura Yamamoto</td>
                    <td className="text-sm font-weight-normal">Support Engineer</td>
                    <td className="text-sm font-weight-normal">Tokyo</td>
                    <td className="text-sm font-weight-normal">37</td>
                    <td className="text-sm font-weight-normal">2009/08/19</td>
                    <td className="text-sm font-weight-normal">$139,575</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Thor Walton</td>
                    <td className="text-sm font-weight-normal">Developer</td>
                    <td className="text-sm font-weight-normal">New York</td>
                    <td className="text-sm font-weight-normal">61</td>
                    <td className="text-sm font-weight-normal">2013/08/11</td>
                    <td className="text-sm font-weight-normal">$98,540</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Finn Camacho</td>
                    <td className="text-sm font-weight-normal">Support Engineer</td>
                    <td className="text-sm font-weight-normal">San Francisco</td>
                    <td className="text-sm font-weight-normal">47</td>
                    <td className="text-sm font-weight-normal">2009/07/07</td>
                    <td className="text-sm font-weight-normal">$87,500</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Serge Baldwin</td>
                    <td className="text-sm font-weight-normal">Data Coordinator</td>
                    <td className="text-sm font-weight-normal">Singapore</td>
                    <td className="text-sm font-weight-normal">64</td>
                    <td className="text-sm font-weight-normal">2012/04/09</td>
                    <td className="text-sm font-weight-normal">$138,575</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Zenaida Frank</td>
                    <td className="text-sm font-weight-normal">Software Engineer</td>
                    <td className="text-sm font-weight-normal">New York</td>
                    <td className="text-sm font-weight-normal">63</td>
                    <td className="text-sm font-weight-normal">2010/01/04</td>
                    <td className="text-sm font-weight-normal">$125,250</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Zorita Serrano</td>
                    <td className="text-sm font-weight-normal">Software Engineer</td>
                    <td className="text-sm font-weight-normal">San Francisco</td>
                    <td className="text-sm font-weight-normal">56</td>
                    <td className="text-sm font-weight-normal">2012/06/01</td>
                    <td className="text-sm font-weight-normal">$115,000</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Jennifer Acosta</td>
                    <td className="text-sm font-weight-normal">Junior Javascript Developer</td>
                    <td className="text-sm font-weight-normal">Edinburgh</td>
                    <td className="text-sm font-weight-normal">43</td>
                    <td className="text-sm font-weight-normal">2013/02/01</td>
                    <td className="text-sm font-weight-normal">$75,650</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Cara Stevens</td>
                    <td className="text-sm font-weight-normal">Sales Assistant</td>
                    <td className="text-sm font-weight-normal">New York</td>
                    <td className="text-sm font-weight-normal">46</td>
                    <td className="text-sm font-weight-normal">2011/12/06</td>
                    <td className="text-sm font-weight-normal">$145,600</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Hermione Butler</td>
                    <td className="text-sm font-weight-normal">Regional Director</td>
                    <td className="text-sm font-weight-normal">London</td>
                    <td className="text-sm font-weight-normal">47</td>
                    <td className="text-sm font-weight-normal">2011/03/21</td>
                    <td className="text-sm font-weight-normal">$356,250</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Lael Greer</td>
                    <td className="text-sm font-weight-normal">Systems Administrator</td>
                    <td className="text-sm font-weight-normal">London</td>
                    <td className="text-sm font-weight-normal">21</td>
                    <td className="text-sm font-weight-normal">2009/02/27</td>
                    <td className="text-sm font-weight-normal">$103,500</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Jonas Alexander</td>
                    <td className="text-sm font-weight-normal">Developer</td>
                    <td className="text-sm font-weight-normal">San Francisco</td>
                    <td className="text-sm font-weight-normal">30</td>
                    <td className="text-sm font-weight-normal">2010/07/14</td>
                    <td className="text-sm font-weight-normal">$86,500</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Shad Decker</td>
                    <td className="text-sm font-weight-normal">Regional Director</td>
                    <td className="text-sm font-weight-normal">Edinburgh</td>
                    <td className="text-sm font-weight-normal">51</td>
                    <td className="text-sm font-weight-normal">2008/11/13</td>
                    <td className="text-sm font-weight-normal">$183,000</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Michael Bruce</td>
                    <td className="text-sm font-weight-normal">Javascript Developer</td>
                    <td className="text-sm font-weight-normal">Singapore</td>
                    <td className="text-sm font-weight-normal">29</td>
                    <td className="text-sm font-weight-normal">2011/06/27</td>
                    <td className="text-sm font-weight-normal">$183,000</td>
                  </tr>
                  <tr>
                    <td className="text-sm font-weight-normal">Donna Snider</td>
                    <td className="text-sm font-weight-normal">Customer Support</td>
                    <td className="text-sm font-weight-normal">New York</td>
                    <td className="text-sm font-weight-normal">27</td>
                    <td className="text-sm font-weight-normal">2011/01/25</td>
                    <td className="text-sm font-weight-normal">$112,000</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Category;
